import {
  clampNumber,
  resolveImageLayerForPreview,
  resolveTextLayerWithinSlot,
  TEMPLATE_REFERENCE_WIDTH,
  type TemplateElement,
  type TemplateTextElement
} from './project-model';

const previewImageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadPreviewImage(src: string) {
  const cached = previewImageCache.get(src);
  if (cached) return cached;

  const loader = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

  previewImageCache.set(src, loader);
  return loader;
}

export function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const maxRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + maxRadius, y);
  context.lineTo(x + width - maxRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + maxRadius);
  context.lineTo(x + width, y + height - maxRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - maxRadius, y + height);
  context.lineTo(x + maxRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - maxRadius);
  context.lineTo(x, y + maxRadius);
  context.quadraticCurveTo(x, y, x + maxRadius, y);
  context.closePath();
}

export function drawCheckerPattern(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number
) {
  const cell = Math.max(8, size);
  for (let row = 0; row < Math.ceil(height / cell); row += 1) {
    for (let col = 0; col < Math.ceil(width / cell); col += 1) {
      const isLight = (row + col) % 2 === 0;
      context.fillStyle = isLight ? '#eceef3' : '#d7d9df';
      context.fillRect(x + col * cell, y + row * cell, cell, cell);
    }
  }
}

export function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = words[0];
    if (context.measureText(current).width > maxWidth) {
      current = '';
      for (const char of words[0]) {
        const candidate = `${current}${char}`;
        if (current && context.measureText(candidate).width > maxWidth) {
          lines.push(current);
          current = char;
          continue;
        }
        current = candidate;
      }
    }

    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${current} ${words[index]}`;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = '';
        for (const char of words[index]) {
          const next = `${current}${char}`;
          if (current && context.measureText(next).width > maxWidth) {
            lines.push(current);
            current = char;
            continue;
          }
          current = next;
        }
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

export function getTextValueBySource(layer: TemplateTextElement, title: string, subtitle: string) {
  if (layer.textSource === 'title') return title;
  if (layer.textSource === 'subtitle') return subtitle;
  return layer.customText;
}

export function getTextLineHeightPx(layer: TemplateTextElement) {
  const ratio = Math.max(0.5, layer.lineHeight || 1.2);
  return Math.max(1, layer.size || 48) * ratio;
}

export function resolveAutoTextSize(
  context: CanvasRenderingContext2D,
  layer: TemplateTextElement,
  text: string
) {
  const size = Math.max(1, layer.size || 48);
  const weight = layer.weight || 600;
  const family = layer.font || 'SF Pro';
  const padding = Math.max(0, layer.padding || 0);
  const lineHeightPx = getTextLineHeightPx(layer);
  const contentWidth = Math.max(1, layer.w - padding * 2);

  context.save();
  context.font = `${weight} ${size}px "${family}", "Apple SD Gothic Neo", sans-serif`;
  const lines = wrapLines(context, text, contentWidth);
  context.restore();

  const contentHeight = Math.max(1, Math.ceil(lines.length * lineHeightPx));

  return {
    height: Math.max(1, contentHeight + Math.ceil(padding * 2))
  };
}

export function resolveTextLayerForPreview(
  layer: TemplateTextElement,
  slotWidth: number,
  scaleTextToDevice: boolean
): TemplateTextElement {
  const resolvedLayer = resolveTextLayerWithinSlot(layer, slotWidth);
  if (!scaleTextToDevice) {
    return resolvedLayer;
  }

  const safeSlotWidth = Math.max(1, slotWidth);
  if (safeSlotWidth === TEMPLATE_REFERENCE_WIDTH) {
    return resolvedLayer;
  }

  const scale = Math.max(0.0001, safeSlotWidth / TEMPLATE_REFERENCE_WIDTH);
  const scaledX = clampNumber(
    Math.round(resolvedLayer.x * scale),
    0,
    Math.max(0, Math.max(1, safeSlotWidth) - resolvedLayer.w)
  );
  const scaledY = Math.round(resolvedLayer.y * scale);
  const scaledSize = Math.max(1, Math.round(resolvedLayer.size * scale));
  const scaledPadding = Math.max(0, Math.round(resolvedLayer.padding * scale));
  const scaledCornerRadius = Math.max(0, Math.round(resolvedLayer.cornerRadius * scale));
  const scaledHeight = resolvedLayer.autoSize
    ? resolvedLayer.h
    : Math.max(1, Math.round(resolvedLayer.h * scale));

  if (
    resolvedLayer.x === scaledX
    && resolvedLayer.y === scaledY
    && resolvedLayer.size === scaledSize
    && resolvedLayer.padding === scaledPadding
    && resolvedLayer.cornerRadius === scaledCornerRadius
    && resolvedLayer.h === scaledHeight
  ) {
    return resolvedLayer;
  }

  return {
    ...resolvedLayer,
    x: scaledX,
    y: scaledY,
    size: scaledSize,
    padding: scaledPadding,
    cornerRadius: scaledCornerRadius,
    h: scaledHeight
  };
}

export function resolvePreviewLayer(
  context: CanvasRenderingContext2D,
  layer: TemplateElement,
  title: string,
  subtitle: string,
  slotWidth: number,
  _slotHeight: number,
  options?: {
    scaleImageToDevice?: boolean;
    scaleTextToDevice?: boolean;
  }
): TemplateElement {
  if (layer.kind === 'image') {
    if (!options?.scaleImageToDevice) {
      return layer;
    }
    return resolveImageLayerForPreview(layer, slotWidth);
  }

  if (layer.kind !== 'text') {
    return layer;
  }

  const resolvedLayer = resolveTextLayerForPreview(layer, slotWidth, Boolean(options?.scaleTextToDevice));
  if (!resolvedLayer.autoSize) {
    if (
      resolvedLayer.x === layer.x
      && resolvedLayer.y === layer.y
      && resolvedLayer.w === layer.w
      && resolvedLayer.h === layer.h
      && resolvedLayer.widthPercent === layer.widthPercent
      && resolvedLayer.size === layer.size
      && resolvedLayer.padding === layer.padding
      && resolvedLayer.cornerRadius === layer.cornerRadius
    ) {
      return layer;
    }
    return resolvedLayer;
  }

  const text = getTextValueBySource(resolvedLayer, title, subtitle);
  const { height } = resolveAutoTextSize(context, resolvedLayer, text);
  if (
    resolvedLayer.x === layer.x
    && resolvedLayer.y === layer.y
    && resolvedLayer.w === layer.w
    && resolvedLayer.h === height
    && resolvedLayer.widthPercent === layer.widthPercent
    && resolvedLayer.size === layer.size
    && resolvedLayer.padding === layer.padding
    && resolvedLayer.cornerRadius === layer.cornerRadius
  ) {
    return layer;
  }

  return {
    ...resolvedLayer,
    h: height
  };
}

export function drawTextBlock(
  context: CanvasRenderingContext2D,
  layer: TemplateTextElement,
  text: string
) {
  const size = Math.max(1, layer.size || 48);
  const weight = layer.weight || 600;
  const family = layer.font || 'SF Pro';
  const padding = Math.max(0, layer.padding || 0);
  const contentX = layer.x + padding;
  const contentY = layer.y + padding;
  const contentWidth = Math.max(1, layer.w - padding * 2);
  const lineHeight = getTextLineHeightPx(layer);

  if (layer.backgroundColor && layer.backgroundColor !== 'transparent') {
    context.save();
    drawRoundedRectPath(context, layer.x, layer.y, layer.w, layer.h, layer.cornerRadius || 0);
    context.fillStyle = layer.backgroundColor;
    context.fill();
    context.restore();
  }

  context.save();
  context.font = `${weight} ${size}px "${family}", "Apple SD Gothic Neo", sans-serif`;
  context.fillStyle = layer.color || '#f9fafb';
  context.textBaseline = 'top';
  context.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  context.shadowColor = 'rgba(0,0,0,0.2)';
  context.shadowBlur = Math.max(1, Math.round(size * 0.2));
  context.shadowOffsetX = 0;
  context.shadowOffsetY = Math.max(1, Math.round(size * 0.05));

  const lines = wrapLines(context, text, contentWidth);
  let y = contentY;
  for (const line of lines) {
    const x = layer.align === 'center'
      ? contentX + contentWidth / 2
      : layer.align === 'right'
        ? contentX + contentWidth
        : contentX;
    context.fillText(line, x, y);
    y += lineHeight;
  }

  context.restore();
}
