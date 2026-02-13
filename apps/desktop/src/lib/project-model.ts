export type Platform = 'ios' | 'android';
export type Align = 'left' | 'center' | 'right';
export type TemplateElementKind = 'text' | 'image';
export type TemplateTextSource = 'title' | 'subtitle' | 'custom';

export interface Device {
  id: string;
  width: number;
  height: number;
  pixelRatio: number;
  platform?: Platform;
}

export interface Slot {
  id: string;
  name: string;
  order: number;
  sourceImagePath: string;
}

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
  weight: number;
  align: Align;
}

export interface ShotPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  fit: 'cover' | 'contain';
  cornerRadius: number;
}

export interface TemplateElementBase {
  id: string;
  name: string;
  kind: TemplateElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  visible: boolean;
  opacity: number;
  rotation: number;
}

export interface TemplateTextElement extends TemplateElementBase {
  kind: 'text';
  textSource: TemplateTextSource;
  customText: string;
  font: string;
  size: number;
  lineHeight: number;
  weight: number;
  align: Align;
  autoSize: boolean;
  widthPercent: number;
  color: string;
  backgroundColor: string;
  padding: number;
  cornerRadius: number;
}

export interface TemplateImageElement extends TemplateElementBase {
  kind: 'image';
  source: 'image' | 'color';
  imagePath: string;
  fillColor: string;
  fit: 'cover' | 'contain';
  cornerRadius: number;
  deviceFrame: boolean;
  frameInset: number;
  frameRadius: number;
  frameColor: string;
  frameWidth: number;
}

export type TemplateElement = TemplateTextElement | TemplateImageElement;
export type TemplateBackground = {
  type: 'solid' | 'gradient';
  value?: string;
  from?: string;
  to?: string;
  direction?: string;
};

export interface TemplateMain {
  background: TemplateBackground;
  slotBackgrounds: Record<string, TemplateBackground>;
  slotElements: Record<string, TemplateElement[]>;
  frame: {
    type: 'simpleRounded';
    enabled: boolean;
    inset: number;
    radius: number;
  };
  text: {
    title: TextBox;
    subtitle: TextBox;
  };
  shotPlacement: ShotPlacement;
  elements: TemplateElement[];
}

export interface TemplateInstance {
  deviceId?: string;
  locale?: string;
  overrides: Record<string, unknown>;
}

export interface LlmCliConfig {
  command: string;
  argsTemplate: string[];
  timeoutSec: number;
  promptVersion: string;
  prompt?: string;
  cachePath?: string;
  sourceLocale?: string;
  targetLocales?: string[];
}

export interface StoreShotDoc {
  schemaVersion: number;
  project: {
    name: string;
    bundleId: string;
    packageName: string;
    platforms: Platform[];
    locales: string[];
    devices: Device[];
    slots: Slot[];
  };
  template: {
    main: TemplateMain;
    instances: TemplateInstance[];
  };
  copy: {
    keys: Record<string, Record<string, string>>;
  };
  pipelines: {
    localization: {
      mode: 'llm-cli';
      sourceLocale?: string;
      llmCli?: LlmCliConfig;
    };
    export: {
      outputDir: string;
      formats: string[];
      zip: boolean;
      metadataCsv: boolean;
    };
    upload: {
      enabled: boolean;
      fastlane: {
        iosLane: string;
        androidLane: string;
      };
    };
  };
}
export interface SlotCanvasPosition {
  x: number;
  y: number;
}
export const devicePresets: Array<{ label: string; value: Device }> = [
  {
    label: 'iOS Phone (1290x2796)',
    value: { id: 'ios_phone', width: 1290, height: 2796, pixelRatio: 1, platform: 'ios' }
  },
  {
    label: 'Android Phone (1080x1920)',
    value: { id: 'android_phone', width: 1080, height: 1920, pixelRatio: 1, platform: 'android' }
  }
];

export const localePresets = [
  'en-US',
  'ko-KR',
  'ja-JP',
  'zh-CN',
  'zh-TW',
  'fr-FR',
  'de-DE',
  'es-ES',
  'es-MX',
  'es-US',
  'en-GB',
  'en-CA',
  'en-AU',
  'en-IN',
  'fr-CA',
  'pt-PT',
  'pt-BR',
  'it-IT',
  'nl-NL',
  'sv-SE',
  'nb-NO',
  'da-DK',
  'fi-FI',
  'pl-PL',
  'cs-CZ',
  'hu-HU',
  'ro-RO',
  'tr-TR',
  'uk-UA',
  'ru-RU',
  'ar-SA',
  'he-IL',
  'hi-IN',
  'th-TH',
  'vi-VN',
  'id-ID',
  'ms-MY'
];

export const defaultSystemFonts = [
  'SF Pro',
  'SF Pro Display',
  'SF Pro Text',
  'Apple SD Gothic Neo',
  'Helvetica Neue',
  'Arial',
  'Noto Sans',
  'Roboto',
  'Inter'
];

export const defaultLlmConfig: LlmCliConfig = {
  command: 'gemini',
  argsTemplate: [],
  timeoutSec: 120,
  promptVersion: 'v1',
  prompt: [
    'You are an expert ASO localization copywriter for app store screenshots.',
    'Translate naturally for the target locale while preserving conversion intent and mobile-first readability.',
    'Keep the tone benefit-driven, concise, and action-oriented.',
    'Prefer wording that improves discoverability and relevance for app-store users in that locale.',
    'Do not add unnecessary punctuation or emojis unless the source already uses them.'
  ].join('\n')
};
export const SLOT_CANVAS_WIDTH = 24000;
export const SLOT_CANVAS_HEIGHT = 16000;
export const SLOT_CANVAS_PREVIEW_MAX_HEIGHT = 720;
export const SLOT_CANVAS_CARD_CHROME_HEIGHT = 40;
export const SLOT_CANVAS_GAP_X = 8;
export const SLOT_CANVAS_BASE_X = 9600;
export const SLOT_CANVAS_BASE_Y = 880;
export const SLOT_CANVAS_MIN_ZOOM = 0.45;
export const SLOT_CANVAS_MAX_ZOOM = 2.4;
export const PINCH_ZOOM_ACCELERATION = 1.35;
export const TEMPLATE_REFERENCE_WIDTH = 1290;
export const TEMPLATE_REFERENCE_HEIGHT = 2796;

export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function detectPlatformFromDeviceId(deviceId: string): Platform {
  if (deviceId.toLowerCase().includes('android')) return 'android';
  return 'ios';
}

export function detectDevicePlatform(device: Device, enabledPlatforms: Platform[]): Platform {
  const inferred = device.platform || detectPlatformFromDeviceId(device.id);
  if (enabledPlatforms.length === 0) {
    return inferred;
  }

  if (enabledPlatforms.includes(inferred)) {
    return inferred;
  }

  return enabledPlatforms[0];
}

export function fieldKey(slotId: string, kind: 'title' | 'subtitle') {
  return `${slotId}.${kind}`;
}

export function globalTemplateImageKey(elementId: string) {
  return `*:${elementId}`;
}

export function slotTemplateImageKey(slotId: string, elementId: string) {
  return `${slotId}:${elementId}`;
}

export function getSlotPreviewCanvasSize(device: Device) {
  const width = Math.max(1, device.width || 1290);
  const height = Math.max(1, device.height || 2796);
  const renderScale = Math.min(1, SLOT_CANVAS_PREVIEW_MAX_HEIGHT / height);

  return {
    width: Math.max(1, Math.round(width * renderScale)),
    height: Math.max(1, Math.round(height * renderScale)),
    renderScale
  };
}

export function getSlotCanvasCardSize(device: Device) {
  const preview = getSlotPreviewCanvasSize(device);
  return {
    width: preview.width,
    height: preview.height + SLOT_CANVAS_CARD_CHROME_HEIGHT
  };
}

export function normalizeLocaleTag(input: string) {
  const raw = input.trim().replace(/_/g, '-');
  if (!raw) return '';

  const parts = raw.split('-').filter(Boolean);
  if (parts.length === 0) return '';

  const [language, ...rest] = parts;
  const normalized = [
    language.toLowerCase(),
    ...rest.map((part: string, index: number) => {
      if (part.length <= 3) return part.toUpperCase();
      if (index === 0 && part.length === 4) {
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      }

      return part;
    })
  ];

  return normalized.join('-');
}

export function imageMimeTypeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

export function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function appendPathSegment(base: string, segment: string) {
  const trimmedBase = base.trim();
  if (!trimmedBase) return segment;
  return trimmedBase.endsWith('/') ? `${trimmedBase}${segment}` : `${trimmedBase}/${segment}`;
}

export function getParentDirectory(filePath: string) {
  const normalized = filePath.trim().replace(/\\/g, '/');
  if (!normalized) return '';
  const separatorIndex = normalized.lastIndexOf('/');
  if (separatorIndex <= 0) return '';
  return normalized.slice(0, separatorIndex);
}

export function clampTextWidthPercent(value: number) {
  if (!Number.isFinite(value)) return 100;
  return clampNumber(value, 1, 100);
}

export function resolveTextWidthFromPercent(percent: number, slotWidth: number) {
  const normalizedPercent = clampTextWidthPercent(percent);
  return Math.max(1, Math.round((Math.max(1, slotWidth) * normalizedPercent) / 100));
}

export function resolveTextLayerWithinSlot(layer: TemplateTextElement, slotWidth: number): TemplateTextElement {
  const nextWidthPercent = clampTextWidthPercent(layer.widthPercent);
  const nextWidth = resolveTextWidthFromPercent(nextWidthPercent, slotWidth);
  const nextX = clampNumber(layer.x, 0, Math.max(0, Math.max(1, slotWidth) - nextWidth));
  return {
    ...layer,
    widthPercent: nextWidthPercent,
    x: nextX,
    w: nextWidth
  };
}

export function resolveImageLayerForPreview(
  layer: TemplateImageElement,
  slotWidth: number
): TemplateImageElement {
  const safeSlotWidth = Math.max(1, slotWidth);
  if (safeSlotWidth === TEMPLATE_REFERENCE_WIDTH) {
    return layer;
  }

  const scale = Math.max(0.0001, safeSlotWidth / TEMPLATE_REFERENCE_WIDTH);
  const scaledWidth = Math.max(1, Math.round(layer.w * scale));
  const scaledHeight = Math.max(1, Math.round(layer.h * scale));
  const scaledX = clampNumber(Math.round(layer.x * scale), 0, Math.max(0, safeSlotWidth - scaledWidth));
  const scaledY = Math.round(layer.y * scale);
  const scaledCornerRadius = Math.max(0, Math.round(layer.cornerRadius * scale));
  const scaledFrameInset = Math.max(0, Math.round(layer.frameInset * scale));
  const scaledFrameRadius = Math.max(0, Math.round(layer.frameRadius * scale));
  const scaledFrameWidth = Math.max(1, Math.round(layer.frameWidth * scale));

  if (
    layer.x === scaledX
    && layer.y === scaledY
    && layer.w === scaledWidth
    && layer.h === scaledHeight
    && layer.cornerRadius === scaledCornerRadius
    && layer.frameInset === scaledFrameInset
    && layer.frameRadius === scaledFrameRadius
    && layer.frameWidth === scaledFrameWidth
  ) {
    return layer;
  }

  return {
    ...layer,
    x: scaledX,
    y: scaledY,
    w: scaledWidth,
    h: scaledHeight,
    cornerRadius: scaledCornerRadius,
    frameInset: scaledFrameInset,
    frameRadius: scaledFrameRadius,
    frameWidth: scaledFrameWidth
  };
}

export function resolveHorizontalAlignedX(position: Align, slotWidth: number, elementWidth: number) {
  const maxX = Math.max(0, Math.max(1, slotWidth) - Math.max(1, elementWidth));
  if (position === 'left') return 0;
  if (position === 'right') return maxX;
  return Math.round(maxX / 2);
}

export function createDefaultTemplateElements(main: Pick<TemplateMain, 'frame' | 'text' | 'shotPlacement'>): TemplateElement[] {
  return [
    {
      id: 'image-main',
      name: 'Screenshot',
      kind: 'image',
      x: main.shotPlacement.x,
      y: main.shotPlacement.y,
      w: main.shotPlacement.w,
      h: main.shotPlacement.h,
      z: 10,
      visible: true,
      opacity: 100,
      rotation: 0,
      source: 'image',
      imagePath: '',
      fillColor: '#111827',
      fit: main.shotPlacement.fit,
      cornerRadius: main.shotPlacement.cornerRadius,
      deviceFrame: main.frame.enabled,
      frameInset: main.frame.inset,
      frameRadius: main.frame.radius,
      frameColor: '#ffffff',
      frameWidth: 3
    },
    {
      id: 'text-title',
      name: 'Title',
      kind: 'text',
      x: 0,
      y: main.text.title.y,
      w: main.text.title.w,
      h: main.text.title.h,
      z: 20,
      visible: true,
      opacity: 100,
      rotation: 0,
      textSource: 'title',
      customText: '',
      font: main.text.title.font,
      size: main.text.title.size,
      lineHeight: 1.2,
      weight: main.text.title.weight,
      align: main.text.title.align,
      autoSize: true,
      widthPercent: 100,
      color: '#f9fafb',
      backgroundColor: 'transparent',
      padding: 0,
      cornerRadius: 0
    },
    {
      id: 'text-subtitle',
      name: 'Subtitle',
      kind: 'text',
      x: 0,
      y: main.text.subtitle.y,
      w: main.text.subtitle.w,
      h: main.text.subtitle.h,
      z: 30,
      visible: true,
      opacity: 100,
      rotation: 0,
      textSource: 'subtitle',
      customText: '',
      font: main.text.subtitle.font,
      size: main.text.subtitle.size,
      lineHeight: 1.2,
      weight: main.text.subtitle.weight,
      align: main.text.subtitle.align,
      autoSize: true,
      widthPercent: 100,
      color: '#f9fafb',
      backgroundColor: 'transparent',
      padding: 0,
      cornerRadius: 0
    }
  ];
}

export function normalizeTemplateElements(raw: unknown, defaults: TemplateElement[]): TemplateElement[] {
  if (!Array.isArray(raw)) {
    return clone(defaults);
  }

  const normalized = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const kind = source.kind === 'text' || source.kind === 'image' ? source.kind : null;
      if (!kind) return null;

      const fallback = defaults.find((entry) => entry.kind === kind) || defaults[0];
      const base = {
        id: typeof source.id === 'string' && source.id.trim() ? source.id : `${kind}-${index + 1}`,
        name: typeof source.name === 'string' && source.name.trim()
          ? source.name
          : kind === 'text'
            ? `Text ${index + 1}`
            : `Image ${index + 1}`,
        kind,
        x: asNumber(source.x, fallback?.x || 0),
        y: asNumber(source.y, fallback?.y || 0),
        w: Math.max(1, asNumber(source.w, fallback?.w || 100)),
        h: Math.max(1, asNumber(source.h, fallback?.h || 100)),
        z: asNumber(source.z, (index + 1) * 10),
        visible: typeof source.visible === 'boolean' ? source.visible : true,
        opacity: clampNumber(asNumber(source.opacity, 100), 0, 100),
        rotation: asNumber(source.rotation, 0)
      };

      if (kind === 'text') {
        const align = source.align === 'left' || source.align === 'center' || source.align === 'right'
          ? source.align
          : 'center';
        const textSource = source.textSource === 'title' || source.textSource === 'subtitle' || source.textSource === 'custom'
          ? source.textSource
          : 'custom';

        const normalizedText: TemplateTextElement = {
          ...base,
          kind: 'text',
          textSource,
          customText: typeof source.customText === 'string' ? source.customText : '',
          font: typeof source.font === 'string' && source.font.trim() ? source.font : 'SF Pro',
          size: Math.max(1, asNumber(source.size, 48)),
          lineHeight: Math.max(0.5, asNumber(source.lineHeight, 1.2)),
          weight: Math.max(100, asNumber(source.weight, 600)),
          align,
          autoSize: typeof source.autoSize === 'boolean' ? source.autoSize : true,
          widthPercent: clampTextWidthPercent(asNumber(source.widthPercent, 100)),
          color: typeof source.color === 'string' && source.color.trim() ? source.color : '#f9fafb',
          backgroundColor: typeof source.backgroundColor === 'string' && source.backgroundColor.trim()
            ? source.backgroundColor
            : 'transparent',
          padding: Math.max(0, asNumber(source.padding, 0)),
          cornerRadius: Math.max(0, asNumber(source.cornerRadius, 0))
        };
        return normalizedText;
      }

      const normalizedImage: TemplateImageElement = {
        ...base,
        kind: 'image',
        source: source.source === 'color'
          ? 'color'
          : source.source === 'image' || source.source === 'customImage' || source.source === 'slotImage' || source.source === 'none'
            ? 'image'
            : 'image',
        imagePath: typeof source.imagePath === 'string' ? source.imagePath : '',
        fillColor: typeof source.fillColor === 'string' && source.fillColor.trim() ? source.fillColor : '#111827',
        fit: source.fit === 'contain' ? 'contain' : 'cover',
        cornerRadius: Math.max(0, asNumber(source.cornerRadius, 0)),
        deviceFrame: typeof source.deviceFrame === 'boolean' ? source.deviceFrame : false,
        frameInset: Math.max(0, asNumber(source.frameInset, 0)),
        frameRadius: Math.max(0, asNumber(source.frameRadius, 0)),
        frameColor: typeof source.frameColor === 'string' && source.frameColor.trim()
          ? source.frameColor
          : '#ffffff',
        frameWidth: Math.max(1, asNumber(source.frameWidth, 3))
      };
      return normalizedImage;
    })
    .filter((item): item is TemplateElement => item !== null);

  if (normalized.length === 0) {
    return clone(defaults);
  }

  const seen = new Set<string>();
  const deduped = normalized.map((item, index) => {
    let id = item.id;
    while (seen.has(id)) {
      id = `${item.kind}-${index + 1}-${seen.size + 1}`;
    }
    seen.add(id);
    return { ...item, id };
  });

  return deduped
    .sort((a, b) => a.z - b.z)
    .map((item, index) => ({ ...item, z: (index + 1) * 10 }));
}

export function normalizeSlotBackgrounds(
  slots: Slot[],
  slotBackgrounds: Record<string, TemplateBackground> | undefined,
  fallback: TemplateBackground
): Record<string, TemplateBackground> {
  const next: Record<string, TemplateBackground> = {};

  for (const slot of slots) {
    next[slot.id] = {
      ...fallback,
      ...(slotBackgrounds?.[slot.id] || {})
    };
  }

  return next;
}

export function cloneTemplateElements(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((item) => ({ ...item }));
}

export function normalizeTemplateElementOrder(elements: TemplateElement[]): TemplateElement[] {
  return [...elements]
    .sort((a, b) => a.z - b.z)
    .map((item, index) => ({ ...item, z: (index + 1) * 10 }));
}

export function resolveTemplateElementsForSlot(main: Pick<TemplateMain, 'elements' | 'slotElements'>, slotId: string): TemplateElement[] {
  return main.slotElements[slotId] || main.elements;
}

export function normalizeSlotElements(
  slots: Slot[],
  slotElements: unknown,
  fallback: TemplateElement[]
): Record<string, TemplateElement[]> {
  const next: Record<string, TemplateElement[]> = {};
  if (!slotElements || typeof slotElements !== 'object') {
    return next;
  }

  const source = slotElements as Record<string, unknown>;
  for (const slot of slots) {
    const raw = source[slot.id];
    if (!Array.isArray(raw)) continue;

    next[slot.id] = normalizeTemplateElements(raw, fallback);
  }

  return next;
}

export function syncTemplateLegacyFields(main: TemplateMain, slotWidth = 1290): TemplateMain {
  const resolvedElements = [...main.elements]
    .sort((a, b) => a.z - b.z)
    .map((item) => (
      item.kind === 'text'
        ? resolveTextLayerWithinSlot(item, slotWidth)
        : item
    ));
  const sortedElements = resolvedElements;
  const firstImage = sortedElements.find((item): item is TemplateImageElement => item.kind === 'image');
  const titleLayer = sortedElements.find(
    (item): item is TemplateTextElement => item.kind === 'text' && item.textSource === 'title'
  );
  const subtitleLayer = sortedElements.find(
    (item): item is TemplateTextElement => item.kind === 'text' && item.textSource === 'subtitle'
  );

  return {
    ...main,
    elements: sortedElements.map((item, index) => ({ ...item, z: (index + 1) * 10 })),
    shotPlacement: firstImage
      ? {
        ...main.shotPlacement,
        x: firstImage.x,
        y: firstImage.y,
        w: firstImage.w,
        h: firstImage.h,
        fit: firstImage.fit,
        cornerRadius: firstImage.cornerRadius
      }
      : main.shotPlacement,
    frame: firstImage
      ? {
        ...main.frame,
        enabled: firstImage.deviceFrame,
        inset: firstImage.frameInset,
        radius: firstImage.frameRadius
      }
      : main.frame,
    text: {
      title: titleLayer
        ? {
          ...main.text.title,
          x: titleLayer.x,
          y: titleLayer.y,
          w: titleLayer.w,
          h: titleLayer.h,
          font: titleLayer.font,
          size: titleLayer.size,
          weight: titleLayer.weight,
          align: titleLayer.align
        }
        : main.text.title,
      subtitle: subtitleLayer
        ? {
          ...main.text.subtitle,
          x: subtitleLayer.x,
          y: subtitleLayer.y,
          w: subtitleLayer.w,
          h: subtitleLayer.h,
          font: subtitleLayer.font,
          size: subtitleLayer.size,
          weight: subtitleLayer.weight,
          align: subtitleLayer.align
        }
        : main.text.subtitle
    }
  };
}

export function createDefaultProject(): StoreShotDoc {
  const defaultSlots: Slot[] = [
    { id: 'slot1', name: '슬롯 1', order: 1, sourceImagePath: 'examples/assets/source/shot1.png' },
    { id: 'slot2', name: '슬롯 2', order: 2, sourceImagePath: 'examples/assets/source/shot2.png' },
    { id: 'slot3', name: '슬롯 3', order: 3, sourceImagePath: 'examples/assets/source/shot3.png' }
  ];

  const defaultBackground: TemplateBackground = { type: 'gradient', from: '#111827', to: '#1f2937', direction: '180deg' };

  const defaultMainBase: Omit<TemplateMain, 'elements' | 'slotElements'> = {
    background: defaultBackground,
    slotBackgrounds: normalizeSlotBackgrounds(defaultSlots, {}, defaultBackground),
    frame: { type: 'simpleRounded', enabled: true, inset: 80, radius: 80 },
    text: {
      title: { x: 0, y: 120, w: 1290, h: 220, font: 'SF Pro', size: 88, weight: 700, align: 'center' },
      subtitle: { x: 0, y: 330, w: 1290, h: 160, font: 'SF Pro', size: 48, weight: 500, align: 'center' }
    },
    shotPlacement: { x: 120, y: 560, w: 1050, h: 2200, fit: 'cover', cornerRadius: 60 }
  };

  const defaultMain = syncTemplateLegacyFields({
    ...defaultMainBase,
    slotElements: {},
    elements: createDefaultTemplateElements(defaultMainBase)
  });

  return {
    schemaVersion: 1,
    project: {
      name: 'dont mockup again project',
      bundleId: 'com.example.app',
      packageName: 'com.example.app',
      platforms: ['ios', 'android'],
      locales: ['en-US', 'ko-KR'],
      devices: clone(devicePresets.map((preset) => preset.value)),
      slots: defaultSlots
    },
    template: {
      main: defaultMain,
      instances: []
    },
    copy: {
      keys: {
        'app.title': { 'en-US': 'Focus Habit Tracker', 'ko-KR': '포커스 습관 트래커' },
        'app.subtitle': { 'en-US': 'Build better routines daily', 'ko-KR': '매일 더 나은 루틴 만들기' },
        'app.description': {
          'en-US': 'Build routines with simple daily actions, progress insights, and reminders that keep your momentum going.',
          'ko-KR': '간단한 일일 액션, 진행 지표, 리마인더로 루틴을 만들고 꾸준함을 이어가세요.'
        },
        'app.patchNote': {
          'en-US': 'Bug fixes and performance improvements for a smoother onboarding and faster loading.',
          'ko-KR': '온보딩 안정성과 로딩 속도를 개선하기 위한 버그 수정 및 성능 향상이 포함되었습니다.'
        },
        'slot1.title': { 'en-US': 'Clean in 5 minutes', 'ko-KR': '하루 5분이면 충분해요' },
        'slot1.subtitle': { 'en-US': 'Stay on track daily', 'ko-KR': '매일 작게 시작해도 루틴이 됩니다' },
        'slot2.title': { 'en-US': 'Build better habits', 'ko-KR': '작은 습관으로 큰 변화를' },
        'slot2.subtitle': { 'en-US': 'Track goals with ease', 'ko-KR': '목표 진행 상황을 한눈에 관리' },
        'slot3.title': { 'en-US': 'Insights you can use', 'ko-KR': '지표로 보는 성장 흐름' },
        'slot3.subtitle': { 'en-US': 'Know what really works', 'ko-KR': '무엇이 효과적인지 바로 확인' }
      }
    },
    pipelines: {
      localization: {
        mode: 'llm-cli',
        sourceLocale: 'en-US',
        llmCli: clone(defaultLlmConfig)
      },
      export: {
        outputDir: 'dist',
        formats: ['png'],
        zip: true,
        metadataCsv: true
      },
      upload: {
        enabled: false,
        fastlane: {
          iosLane: 'ios metadata',
          androidLane: 'android metadata'
        }
      }
    }
  };
}

export function normalizeProject(raw: unknown): StoreShotDoc {
  const base = createDefaultProject();
  if (!raw || typeof raw !== 'object') return base;

  const doc = raw as Partial<StoreShotDoc>;
  const normalizedSlots = (doc.project?.slots || base.project.slots)
    .map((slot, index) => ({
      ...slot,
      name: typeof slot.name === 'string' && slot.name.trim() ? slot.name : `슬롯 ${index + 1}`,
      order: slot.order || index + 1
    }))
    .sort((a, b) => a.order - b.order);
  const mergedBackground = { ...base.template.main.background, ...doc.template?.main?.background };
  const normalizedElements = normalizeTemplateElements(
    doc.template?.main?.elements,
    createDefaultTemplateElements({
      frame: { ...base.template.main.frame, ...doc.template?.main?.frame },
      text: {
        title: { ...base.template.main.text.title, ...doc.template?.main?.text?.title },
        subtitle: { ...base.template.main.text.subtitle, ...doc.template?.main?.text?.subtitle }
      },
      shotPlacement: { ...base.template.main.shotPlacement, ...doc.template?.main?.shotPlacement }
    })
  );
  const normalizedMain = syncTemplateLegacyFields({
    ...base.template.main,
    ...doc.template?.main,
    background: mergedBackground,
    slotBackgrounds: normalizeSlotBackgrounds(
      normalizedSlots,
      doc.template?.main?.slotBackgrounds as Record<string, TemplateBackground> | undefined,
      mergedBackground
    ),
    slotElements: normalizeSlotElements(
      normalizedSlots,
      doc.template?.main?.slotElements,
      normalizedElements
    ),
    frame: { ...base.template.main.frame, ...doc.template?.main?.frame },
    text: {
      title: { ...base.template.main.text.title, ...doc.template?.main?.text?.title },
      subtitle: { ...base.template.main.text.subtitle, ...doc.template?.main?.text?.subtitle }
    },
    shotPlacement: { ...base.template.main.shotPlacement, ...doc.template?.main?.shotPlacement },
    elements: normalizedElements
  });
  const mergedLocales = doc.project?.locales || base.project.locales;
  const sourceLocaleFromDoc = doc.pipelines?.localization?.sourceLocale || mergedLocales[0] || base.project.locales[0];
  const normalizedSourceLocale = mergedLocales.includes(sourceLocaleFromDoc)
    ? sourceLocaleFromDoc
    : (mergedLocales[0] || base.project.locales[0]);

  return {
    ...base,
    ...doc,
    project: {
      ...base.project,
      ...doc.project,
      platforms: (doc.project?.platforms || base.project.platforms) as Platform[],
      locales: mergedLocales,
      devices: doc.project?.devices || base.project.devices,
      slots: normalizedSlots
    },
    template: {
      main: normalizedMain,
      instances: doc.template?.instances || []
    },
    copy: {
      keys: doc.copy?.keys || base.copy.keys
    },
    pipelines: {
      localization: {
        mode: 'llm-cli',
        sourceLocale: normalizedSourceLocale,
        llmCli: { ...defaultLlmConfig, ...doc.pipelines?.localization?.llmCli }
      },
      export: {
        ...base.pipelines.export,
        ...doc.pipelines?.export
      },
      upload: {
        enabled: doc.pipelines?.upload?.enabled ?? base.pipelines.upload.enabled,
        fastlane: {
          ...base.pipelines.upload.fastlane,
          ...doc.pipelines?.upload?.fastlane
        }
      }
    }
  };
}

export function reorderSlots(slots: Slot[]): Slot[] {
  return slots.map((slot, index) => ({ ...slot, order: index + 1 }));
}

export function buildProjectSnapshotForPersistence(
  doc: StoreShotDoc,
  resolvedOutputDir: string,
  options?: { syncTemplateMain?: boolean; slotWidth?: number }
): StoreShotDoc {
  const next = clone(doc);
  next.project.slots = reorderSlots(next.project.slots);

  if (options?.syncTemplateMain !== false) {
    const slotWidth = Math.max(1, options?.slotWidth || TEMPLATE_REFERENCE_WIDTH);
    next.template.main = syncTemplateLegacyFields(next.template.main, slotWidth);
  }

  next.pipelines.export.outputDir = resolvedOutputDir;
  const sourceLocale = next.pipelines.localization.sourceLocale || next.project.locales[0] || 'en-US';
  next.pipelines.localization.sourceLocale = next.project.locales.includes(sourceLocale)
    ? sourceLocale
    : (next.project.locales[0] || 'en-US');

  return next;
}

export function serializeProjectSignature(snapshot: StoreShotDoc): string {
  return JSON.stringify(snapshot);
}

export function sortSlotsByOrder(slots: Slot[]): Slot[] {
  return [...slots].sort((a, b) => a.order - b.order);
}

export function resolveNextSlotIdentity(slots: Slot[]): { slotId: string; slotNumber: number } {
  const existingIds = new Set(slots.map((slot) => slot.id));
  let slotNumber = slots.reduce((max, slot) => {
    const match = slot.id.match(/^slot(\d+)$/);
    if (!match) return max;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;
  let slotId = `slot${slotNumber}`;

  while (existingIds.has(slotId)) {
    slotNumber += 1;
    slotId = `slot${slotNumber}`;
  }

  return { slotId, slotNumber };
}

export function defaultSlotCanvasPosition(index: number, cardWidth: number): SlotCanvasPosition {
  return {
    x: SLOT_CANVAS_BASE_X + index * (cardWidth + SLOT_CANVAS_GAP_X),
    y: SLOT_CANVAS_BASE_Y
  };
}

export function resolveSlotCanvasPosition(
  positions: Record<string, SlotCanvasPosition>,
  slotId: string,
  index: number,
  cardWidth: number
): SlotCanvasPosition {
  return positions[slotId] || defaultSlotCanvasPosition(index, cardWidth);
}
