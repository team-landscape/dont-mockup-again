import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDevicePlatform } from './project.ts';
import { validateCopyCoverage } from './copy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPresetPath = path.join(__dirname, 'presets', 'store-defaults.json');

export async function loadValidatorPreset(presetPath = defaultPresetPath) {
  const raw = await fs.readFile(presetPath, 'utf8');
  return JSON.parse(raw);
}

function issue(level, code, message, meta = {}) {
  return { level, code, message, ...meta };
}

export function parsePngMeta(buffer) {
  const signature = buffer.subarray(0, 8);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(pngSig)) {
    throw new Error('Not a PNG file');
  }

  const ihdrType = buffer.subarray(12, 16).toString('ascii');
  if (ihdrType !== 'IHDR') {
    throw new Error('Invalid PNG header');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);
  const hasAlpha = colorType === 4 || colorType === 6;

  return { width, height, colorType, hasAlpha };
}

async function readImageMeta(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext !== '.png') {
    return null;
  }

  const data = await fs.readFile(imagePath);
  return parsePngMeta(data);
}

export async function validateProject(projectDoc, options = {}) {
  const project = projectDoc.project || {};
  const preset = options.preset || await loadValidatorPreset(options.presetPath);
  const projectDir = options.projectDir || process.cwd();

  const issues = [];

  const slots = project.slots || [];
  const devices = project.devices || [];

  const copyCoverage = validateCopyCoverage(projectDoc);
  for (const missing of copyCoverage.missing) {
    issues.push(issue('error', 'COPY_MISSING', `Missing copy for ${missing.key} (${missing.locale})`, missing));
  }

  const slotCountsByPlatform = new Map();
  for (const device of devices) {
    const platform = detectDevicePlatform(device, project.platforms || []);
    slotCountsByPlatform.set(platform, slots.length);
  }

  for (const [platform, count] of slotCountsByPlatform.entries()) {
    const rule = preset.platforms?.[platform];
    if (!rule) {
      continue;
    }

    if (count < rule.minScreenshots) {
      issues.push(issue('error', 'SLOT_MIN', `${platform} requires at least ${rule.minScreenshots} screenshots`, { platform }));
    }

    if (count > rule.maxScreenshots) {
      issues.push(issue('error', 'SLOT_MAX', `${platform} allows at most ${rule.maxScreenshots} screenshots`, { platform }));
    }
  }

  for (const slot of slots) {
    const sourcePath = path.resolve(projectDir, slot.sourceImagePath);
    try {
      await fs.access(sourcePath);
    } catch {
      issues.push(issue('error', 'SOURCE_MISSING', `Source image not found: ${slot.sourceImagePath}`, { slotId: slot.id }));
      continue;
    }

    const meta = await readImageMeta(sourcePath);
    if (!meta) {
      continue;
    }

    for (const device of devices) {
      const platform = detectDevicePlatform(device, project.platforms || []);
      const rule = preset.platforms?.[platform];
      if (!rule) {
        continue;
      }

      if (!rule.allowAlpha && meta.hasAlpha) {
        issues.push(issue('error', 'ALPHA_NOT_ALLOWED', `${platform} does not allow alpha in PNG: ${slot.sourceImagePath}`, {
          slotId: slot.id,
          platform
        }));
      }

      if (meta.width < rule.minWidth || meta.width > rule.maxWidth || meta.height < rule.minHeight || meta.height > rule.maxHeight) {
        issues.push(issue('warning', 'RESOLUTION_RANGE', `${slot.sourceImagePath} is outside ${platform} resolution guidance`, {
          slotId: slot.id,
          platform,
          width: meta.width,
          height: meta.height
        }));
      }
    }
  }

  return {
    ok: !issues.some((entry) => entry.level === 'error'),
    issues
  };
}
