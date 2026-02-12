import fs from 'node:fs/promises';
import zlib from 'node:zlib';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => `${char}${char}`).join('')
    : clean.padEnd(6, '0').slice(0, 6);

  const numeric = Number.parseInt(full, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255
  };
}

function blendChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function gradientColor(y, height, from, to) {
  const t = height <= 1 ? 0 : y / (height - 1);
  return {
    r: blendChannel(from.r, to.r, t),
    g: blendChannel(from.g, to.g, t),
    b: blendChannel(from.b, to.b, t)
  };
}

function setPixel(buffer, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }

  const index = (y * width + x) * 3;
  if (index < 0 || index + 2 >= buffer.length) {
    return;
  }

  buffer[index] = color.r;
  buffer[index + 1] = color.g;
  buffer[index + 2] = color.b;
}

function fillRect(buffer, width, height, x, y, w, h, color) {
  const sx = clamp(Math.floor(x), 0, width);
  const sy = clamp(Math.floor(y), 0, height);
  const ex = clamp(Math.floor(x + w), 0, width);
  const ey = clamp(Math.floor(y + h), 0, height);

  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) {
      setPixel(buffer, width, xx, yy, color);
    }
  }
}

function fillRoundedRect(buffer, width, height, x, y, w, h, radius, color) {
  const sx = clamp(Math.floor(x), 0, width);
  const sy = clamp(Math.floor(y), 0, height);
  const ex = clamp(Math.floor(x + w), 0, width);
  const ey = clamp(Math.floor(y + h), 0, height);
  const r = Math.max(0, Math.floor(radius));

  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) {
      const localX = xx - sx;
      const localY = yy - sy;
      const right = ex - sx - 1;
      const bottom = ey - sy - 1;

      let draw = true;
      if (localX < r && localY < r) {
        draw = ((localX - r) ** 2 + (localY - r) ** 2) <= r ** 2;
      } else if (localX > right - r && localY < r) {
        draw = ((localX - (right - r)) ** 2 + (localY - r) ** 2) <= r ** 2;
      } else if (localX < r && localY > bottom - r) {
        draw = ((localX - r) ** 2 + (localY - (bottom - r)) ** 2) <= r ** 2;
      } else if (localX > right - r && localY > bottom - r) {
        draw = ((localX - (right - r)) ** 2 + (localY - (bottom - r)) ** 2) <= r ** 2;
      }

      if (draw) {
        setPixel(buffer, width, xx, yy, color);
      }
    }
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rawRowOffset = y * rowLength;
    raw[rawRowOffset] = 0;
    const srcOffset = y * width * 3;
    rgba.copy(raw, rawRowOffset + 1, srcOffset, srcOffset + width * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawTextBars(buffer, width, height, box, lines, maxChars) {
  const lineHeight = Math.floor((box.size || 40) * 1.2);
  const barHeight = Math.max(6, Math.floor((box.size || 40) * 0.68));
  const color = { r: 245, g: 247, b: 255 };

  lines.forEach((line, index) => {
    const y = box.y + index * lineHeight + Math.floor((lineHeight - barHeight) / 2);
    const ratio = clamp(line.length / Math.max(1, maxChars), 0.24, 1);
    const w = Math.floor(box.w * ratio);
    fillRoundedRect(buffer, width, height, box.x, y, w, barHeight, Math.floor(barHeight / 2), color);
  });
}

function buildBackground(width, height, background) {
  const buffer = Buffer.alloc(width * height * 3);

  if (background?.type === 'gradient') {
    const from = hexToRgba(background.from || '#1f2937');
    const to = hexToRgba(background.to || '#111827');

    for (let y = 0; y < height; y += 1) {
      const color = gradientColor(y, height, from, to);
      for (let x = 0; x < width; x += 1) {
        setPixel(buffer, width, x, y, color);
      }
    }

    return buffer;
  }

  const solid = hexToRgba(background?.value || '#1f2937');
  fillRect(buffer, width, height, 0, 0, width, height, solid);
  return buffer;
}

export async function renderSceneWithFallback(scene, outPath) {
  const width = scene.width;
  const height = scene.height;
  const pixels = buildBackground(width, height, scene.background);

  if (scene.frame?.enabled !== false) {
    const inset = scene.frame?.inset || 0;
    const radius = scene.frame?.radius || 0;
    fillRoundedRect(
      pixels,
      width,
      height,
      inset,
      inset,
      width - inset * 2,
      height - inset * 2,
      radius,
      { r: 85, g: 97, b: 120 }
    );
  }

  const shot = scene.shotPlacement;
  fillRoundedRect(
    pixels,
    width,
    height,
    shot.x,
    shot.y,
    shot.w,
    shot.h,
    shot.cornerRadius || 0,
    { r: 23, g: 33, b: 58 }
  );

  drawTextBars(
    pixels,
    width,
    height,
    scene.text.title,
    scene.text.title.lines || [scene.text.title.value || ''],
    Math.max(1, scene.text.title.maxCharsPerLine || 12)
  );

  drawTextBars(
    pixels,
    width,
    height,
    scene.text.subtitle,
    scene.text.subtitle.lines || [scene.text.subtitle.value || ''],
    Math.max(1, scene.text.subtitle.maxCharsPerLine || 12)
  );

  const png = encodePng(width, height, pixels);
  await fs.writeFile(outPath, png);
}
