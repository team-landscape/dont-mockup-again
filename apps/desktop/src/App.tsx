import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { ArrowDown, ArrowUp, ChevronDown, FolderDown, FolderUp, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { ScrollArea } from './components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select';
import { Switch } from './components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Textarea } from './components/ui/textarea';

type Tab = 'screens' | 'localization' | 'preview' | 'export';
type Platform = 'ios' | 'android';
type Align = 'left' | 'center' | 'right';

interface Device {
  id: string;
  width: number;
  height: number;
  pixelRatio: number;
  platform?: Platform;
}

interface Slot {
  id: string;
  order: number;
  sourceImagePath: string;
}

interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
  weight: number;
  align: Align;
}

interface ShotPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  fit: 'cover' | 'contain';
  cornerRadius: number;
}

interface TemplateMain {
  background: {
    type: 'solid' | 'gradient';
    value?: string;
    from?: string;
    to?: string;
    direction?: string;
  };
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
}

interface TemplateInstance {
  deviceId?: string;
  locale?: string;
  overrides: Record<string, unknown>;
}

interface LlmCliConfig {
  command: string;
  argsTemplate: string[];
  timeoutSec: number;
  glossaryPath?: string;
  styleGuidePath?: string;
}

interface StoreShotDoc {
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
      mode: 'byoy' | 'llm-cli';
      llmCli?: LlmCliConfig;
    };
    export: {
      outputDir: string;
      formats: string[];
      zip: boolean;
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

interface ValidateIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

interface SlotCanvasPosition {
  x: number;
  y: number;
}

const tabs: Array<{ id: Tab; title: string; description: string }> = [
  { id: 'screens', title: 'Screens', description: '미리보기 + 슬롯 + 템플릿 편집 Composer' },
  { id: 'localization', title: 'Localization', description: 'BYOY import + LLM CLI 설정 + copy 편집' },
  { id: 'preview', title: 'Preview / Validate', description: '렌더/검증/프리뷰' },
  { id: 'export', title: 'Export', description: 'dist/zip export' }
];

const devicePresets: Array<{ label: string; value: Device }> = [
  {
    label: 'iOS Phone (1290x2796)',
    value: { id: 'ios_phone', width: 1290, height: 2796, pixelRatio: 1, platform: 'ios' }
  },
  {
    label: 'Android Phone (1080x1920)',
    value: { id: 'android_phone', width: 1080, height: 1920, pixelRatio: 1, platform: 'android' }
  }
];

const localePresets = [
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

const defaultSystemFonts = [
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

const defaultLlmConfig: LlmCliConfig = {
  command: 'gemini-cli',
  argsTemplate: ['translate', '--in', '{INPUT}', '--out', '{OUTPUT}', '--to', '{LOCALE}'],
  timeoutSec: 120,
  glossaryPath: 'glossary.csv',
  styleGuidePath: 'style.md'
};
const XL_MEDIA_QUERY = '(min-width: 1280px)';
const ONBOARDING_STORAGE_KEY = 'storeshot.desktop.onboarding.v1.completed';
const SLOT_CANVAS_WIDTH = 24000;
const SLOT_CANVAS_HEIGHT = 16000;
const SLOT_CANVAS_CARD_WIDTH = 540;
const SLOT_CANVAS_CARD_HEIGHT = 760;
const SLOT_CANVAS_GAP_X = 48;
const SLOT_CANVAS_GAP_Y = 56;
const SLOT_CANVAS_DEFAULT_COLS = 3;
const SLOT_CANVAS_BASE_X = 9600;
const SLOT_CANVAS_BASE_Y = 880;
const SLOT_CANVAS_MIN_ZOOM = 0.45;
const SLOT_CANVAS_MAX_ZOOM = 2.4;

async function runPipeline(command: string, args: string[]) {
  return invokeCommand<string>('run_pipeline', { command, args });
}

async function readTextFile(path: string) {
  return invokeCommand<string>('read_text_file', { path });
}

async function writeTextFile(path: string, content: string) {
  return invokeCommand<void>('write_text_file', { path, content });
}

async function listPngFiles(path: string) {
  return invokeCommand<string[]>('list_png_files', { path });
}

async function readFileBase64(path: string) {
  return invokeCommand<string>('read_file_base64', { path });
}

async function listSystemFonts() {
  return invokeCommand<string[]>('list_system_fonts', {});
}

async function writeFileBase64(path: string, dataBase64: string) {
  return invokeCommand<void>('write_file_base64', { path, dataBase64 });
}

function browserFileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid file read result'));
        return;
      }

      const base64 = reader.result.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function isTauriRuntime() {
  return typeof window !== 'undefined'
    && typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';
}

async function invokeCommand<T>(command: string, payload: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('Tauri runtime is not detected. Run `npm --prefix apps/desktop run tauri:dev`.');
  }

  return tauriInvoke<T>(command, payload);
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function detectPlatformFromDeviceId(deviceId: string): Platform {
  if (deviceId.toLowerCase().includes('android')) return 'android';
  return 'ios';
}

function fieldKey(slotId: string, kind: 'title' | 'subtitle') {
  return `${slotId}.${kind}`;
}

function normalizeLocaleTag(input: string) {
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

function imageMimeTypeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function createDefaultProject(): StoreShotDoc {
  return {
    schemaVersion: 1,
    project: {
      name: 'StoreShot Studio Project',
      bundleId: 'com.example.app',
      packageName: 'com.example.app',
      platforms: ['ios', 'android'],
      locales: ['en-US', 'ko-KR'],
      devices: clone(devicePresets.map((preset) => preset.value)),
      slots: [
        { id: 'slot1', order: 1, sourceImagePath: 'examples/assets/source/shot1.png' },
        { id: 'slot2', order: 2, sourceImagePath: 'examples/assets/source/shot2.png' },
        { id: 'slot3', order: 3, sourceImagePath: 'examples/assets/source/shot3.png' }
      ]
    },
    template: {
      main: {
        background: { type: 'gradient', from: '#111827', to: '#1f2937', direction: '180deg' },
        frame: { type: 'simpleRounded', enabled: true, inset: 80, radius: 80 },
        text: {
          title: { x: 80, y: 120, w: 1130, h: 220, font: 'SF Pro', size: 88, weight: 700, align: 'left' },
          subtitle: { x: 80, y: 330, w: 1130, h: 160, font: 'SF Pro', size: 48, weight: 500, align: 'left' }
        },
        shotPlacement: { x: 120, y: 560, w: 1050, h: 2200, fit: 'cover', cornerRadius: 60 }
      },
      instances: []
    },
    copy: {
      keys: {
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
        mode: 'byoy',
        llmCli: clone(defaultLlmConfig)
      },
      export: {
        outputDir: 'dist',
        formats: ['png'],
        zip: true
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

function normalizeProject(raw: unknown): StoreShotDoc {
  const base = createDefaultProject();
  if (!raw || typeof raw !== 'object') return base;

  const doc = raw as Partial<StoreShotDoc>;
  return {
    ...base,
    ...doc,
    project: {
      ...base.project,
      ...doc.project,
      platforms: (doc.project?.platforms || base.project.platforms) as Platform[],
      locales: doc.project?.locales || base.project.locales,
      devices: doc.project?.devices || base.project.devices,
      slots: (doc.project?.slots || base.project.slots)
        .map((slot, index) => ({ ...slot, order: slot.order || index + 1 }))
        .sort((a, b) => a.order - b.order)
    },
    template: {
      main: {
        ...base.template.main,
        ...doc.template?.main,
        background: { ...base.template.main.background, ...doc.template?.main?.background },
        frame: { ...base.template.main.frame, ...doc.template?.main?.frame },
        text: {
          title: { ...base.template.main.text.title, ...doc.template?.main?.text?.title },
          subtitle: { ...base.template.main.text.subtitle, ...doc.template?.main?.text?.subtitle }
        },
        shotPlacement: { ...base.template.main.shotPlacement, ...doc.template?.main?.shotPlacement }
      },
      instances: doc.template?.instances || []
    },
    copy: {
      keys: doc.copy?.keys || base.copy.keys
    },
    pipelines: {
      localization: {
        mode: doc.pipelines?.localization?.mode || base.pipelines.localization.mode,
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

function reorderSlots(slots: Slot[]): Slot[] {
  return slots
    .map((slot, index) => ({ ...slot, order: index + 1 }))
    .sort((a, b) => a.order - b.order);
}

function defaultSlotCanvasPosition(index: number): SlotCanvasPosition {
  const col = index % SLOT_CANVAS_DEFAULT_COLS;
  const row = Math.floor(index / SLOT_CANVAS_DEFAULT_COLS);
  return {
    x: SLOT_CANVAS_BASE_X + col * (SLOT_CANVAS_CARD_WIDTH + SLOT_CANVAS_GAP_X),
    y: SLOT_CANVAS_BASE_Y + row * (SLOT_CANVAS_CARD_HEIGHT + SLOT_CANVAS_GAP_Y)
  };
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('screens');
  const projectPath = 'examples/sample.storeshot.json';
  const [doc, setDoc] = useState<StoreShotDoc>(() => createDefaultProject());
  const [outputDir, setOutputDir] = useState('dist');
  const [log, setLog] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const [byoyPath, setByoyPath] = useState('examples/byoy.sample.json');
  const [selectedDevice, setSelectedDevice] = useState('ios_phone');
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const [selectedSlot, setSelectedSlot] = useState('slot1');
  const [screenFocusTrigger, setScreenFocusTrigger] = useState(0);
  const [slotPreviewUrls, setSlotPreviewUrls] = useState<Record<string, string>>({});
  const [slotPreviewPaths, setSlotPreviewPaths] = useState<Record<string, string>>({});
  const [slotSourceUrls, setSlotSourceUrls] = useState<Record<string, string>>({});
  const [slotCanvasPositions, setSlotCanvasPositions] = useState<Record<string, SlotCanvasPosition>>({});
  const [availableFonts, setAvailableFonts] = useState<string[]>(defaultSystemFonts);
  const [issues, setIssues] = useState<ValidateIssue[]>([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1';
  });
  const [isXlLayout, setIsXlLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(XL_MEDIA_QUERY).matches;
  });
  const slotFileInputRef = useRef<HTMLInputElement>(null);
  const slotFileTargetRef = useRef<string | null>(null);
  const slotSourceEntriesRef = useRef<Array<{ id: string; sourceImagePath: string }>>([]);
  const [, startSlotTransition] = useTransition();

  const renderDir = useMemo(() => `${outputDir}-render`, [outputDir]);

  const activeTabDescription = useMemo(() => {
    return tabs.find((item) => item.id === activeTab)?.description || '';
  }, [activeTab]);

  const selectedPlatform = useMemo<Platform>(() => {
    const device = doc.project.devices.find((entry) => entry.id === selectedDevice);
    if (device?.platform) return device.platform;
    return detectPlatformFromDeviceId(selectedDevice);
  }, [doc.project.devices, selectedDevice]);

  const selectedDeviceSpec = useMemo<Device>(() => {
    const found = doc.project.devices.find((entry) => entry.id === selectedDevice);
    if (found) return found;
    return { id: selectedDevice, width: 1290, height: 2796, pixelRatio: 1, platform: selectedPlatform };
  }, [doc.project.devices, selectedDevice, selectedPlatform]);

  const copyKeys = useMemo(() => {
    const keys = doc.project.slots.flatMap((slot) => [fieldKey(slot.id, 'title'), fieldKey(slot.id, 'subtitle')]);
    return [...new Set(keys)];
  }, [doc.project.slots]);

  const expectedPreviewPath = useMemo(
    () => `${renderDir}/${selectedPlatform}/${selectedDevice}/${selectedLocale}/${selectedSlot}.png`,
    [renderDir, selectedPlatform, selectedDevice, selectedLocale, selectedSlot]
  );

  const llmConfig = doc.pipelines.localization.llmCli || clone(defaultLlmConfig);
  const slotSourceLoadKey = useMemo(() => {
    const entries = doc.project.slots.map((slot) => ({ id: slot.id, sourceImagePath: slot.sourceImagePath }));
    slotSourceEntriesRef.current = entries;
    return entries.map((entry) => `${entry.id}:${entry.sourceImagePath}`).join('|');
  }, [doc.project.slots]);

  useEffect(() => {
    if (activeTab !== 'screens') return;
    setScreenFocusTrigger((current) => current + 1);
  }, [activeTab]);

  useEffect(() => {
    if (!doc.project.locales.includes(selectedLocale)) {
      setSelectedLocale(doc.project.locales[0] || 'en-US');
    }

    if (!doc.project.devices.some((device) => device.id === selectedDevice)) {
      setSelectedDevice(doc.project.devices[0]?.id || 'ios_phone');
    }

    if (!doc.project.slots.some((slot) => slot.id === selectedSlot)) {
      setSelectedSlot(doc.project.slots[0]?.id || 'slot1');
    }
  }, [doc.project.devices, doc.project.locales, doc.project.slots, selectedDevice, selectedLocale, selectedSlot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(XL_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsXlLayout(event.matches);
    };

    setIsXlLayout(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setAvailableFonts(defaultSystemFonts);
      return;
    }

    listSystemFonts()
      .then((fonts) => {
        if (fonts.length > 0) {
          setAvailableFonts(fonts);
        }
      })
      .catch(() => {
        setAvailableFonts(defaultSystemFonts);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSourceImages() {
      if (!isTauriRuntime()) {
        if (!cancelled) setSlotSourceUrls({});
        return;
      }

      const next: Record<string, string> = {};
      for (const slot of slotSourceEntriesRef.current) {
        if (!slot.sourceImagePath) continue;

        try {
          const base64 = await readFileBase64(slot.sourceImagePath);
          const mime = imageMimeTypeFromPath(slot.sourceImagePath);
          next[slot.id] = `data:${mime};base64,${base64}`;
        } catch {
          // Missing source image is allowed while editing.
        }
      }

      if (!cancelled) {
        setSlotSourceUrls(next);
      }
    }

    void loadSourceImages();
    return () => {
      cancelled = true;
    };
  }, [slotSourceLoadKey]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setLog('Web UI preview mode. Tauri commands are disabled. Run `tauri:dev` for full functionality.');
      return;
    }

    readTextFile(projectPath)
      .then((text) => {
        const parsed = extractJson(text);
        if (!parsed) return;

        const normalized = normalizeProject(parsed);
        setDoc(normalized);
        setOutputDir(normalized.pipelines.export.outputDir || 'dist');
        setLog(`Loaded project: ${projectPath}`);
      })
      .catch(() => {
        setLog('Sample project could not be auto-loaded. Create New or Load manually.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDoc(mutator: (next: StoreShotDoc) => void) {
    setDoc((current) => {
      const next = clone(current);
      mutator(next);
      return next;
    });
  }

  async function runWithLog(action: () => Promise<string>) {
    setIsBusy(true);
    try {
      const output = await action();
      setLog(output);
      return output;
    } catch (error) {
      const message = String(error);
      setLog(message);
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLoadProject() {
    await runWithLog(async () => {
      const text = await readTextFile(projectPath);
      const parsed = extractJson(text);
      const normalized = normalizeProject(parsed);
      setDoc(normalized);
      setOutputDir(normalized.pipelines.export.outputDir || 'dist');
      return `Loaded project: ${projectPath}`;
    });
  }

  async function handleSaveProject() {
    await runWithLog(async () => {
      const next = clone(doc);
      next.project.slots = reorderSlots(next.project.slots);
      next.pipelines.export.outputDir = outputDir;
      await writeTextFile(projectPath, JSON.stringify(next, null, 2));
      return `Saved project: ${projectPath}`;
    });
  }

  function handleCreateNewProject() {
    const fresh = createDefaultProject();
    setDoc(fresh);
    setOutputDir(fresh.pipelines.export.outputDir);
    setIssues([]);
    setLog('Created new in-memory project. Save to persist.');
  }

  function togglePlatform(platform: Platform, checked: boolean) {
    updateDoc((next) => {
      const current = new Set(next.project.platforms);
      if (checked) current.add(platform);
      else current.delete(platform);

      next.project.platforms = Array.from(current) as Platform[];
      next.project.devices = next.project.devices.filter((device) => {
        const detected = device.platform || detectPlatformFromDeviceId(device.id);
        return next.project.platforms.includes(detected);
      });
    });
  }

  function toggleDevicePreset(presetDevice: Device, checked: boolean) {
    updateDoc((next) => {
      const exists = next.project.devices.some((device) => device.id === presetDevice.id);
      if (checked && !exists) {
        next.project.devices.push(clone(presetDevice));
      }

      if (!checked) {
        next.project.devices = next.project.devices.filter((device) => device.id !== presetDevice.id);
      }
    });
  }

  function moveSlot(slotId: string, direction: -1 | 1) {
    updateDoc((next) => {
      const ordered = [...next.project.slots].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((slot) => slot.id === slotId);
      if (index < 0) return;

      const target = index + direction;
      if (target < 0 || target >= ordered.length) return;

      const [picked] = ordered.splice(index, 1);
      ordered.splice(target, 0, picked);
      next.project.slots = reorderSlots(ordered);
    });
  }

  function addSlot() {
    updateDoc((next) => {
      const existingIds = new Set(next.project.slots.map((slot) => slot.id));
      let nextNumber = next.project.slots.reduce((max, slot) => {
        const match = slot.id.match(/^slot(\d+)$/);
        if (!match) return max;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0) + 1;
      let nextId = `slot${nextNumber}`;

      while (existingIds.has(nextId)) {
        nextNumber += 1;
        nextId = `slot${nextNumber}`;
      }

      const nextIndex = next.project.slots.length + 1;
      const newSlot = {
        id: nextId,
        order: nextIndex,
        sourceImagePath: `examples/assets/source/shot${Math.min(3, nextNumber)}.png`
      };

      next.project.slots.push(newSlot);
      next.copy.keys[fieldKey(newSlot.id, 'title')] = {};
      next.copy.keys[fieldKey(newSlot.id, 'subtitle')] = {};
    });
  }

  function removeSlot(slotId: string) {
    updateDoc((next) => {
      next.project.slots = reorderSlots(next.project.slots.filter((slot) => slot.id !== slotId));
      delete next.copy.keys[fieldKey(slotId, 'title')];
      delete next.copy.keys[fieldKey(slotId, 'subtitle')];
    });
  }

  async function handleImportByoy() {
    await runWithLog(async () => {
      const text = await readTextFile(byoyPath);
      const parsed = extractJson(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('BYOY JSON format is invalid');
      }

      updateDoc((next) => {
        for (const [key, localeMap] of Object.entries(parsed as Record<string, unknown>)) {
          if (!localeMap || typeof localeMap !== 'object') continue;
          next.copy.keys[key] = next.copy.keys[key] || {};

          for (const [locale, value] of Object.entries(localeMap as Record<string, unknown>)) {
            if (typeof value === 'string') next.copy.keys[key][locale] = value;
          }
        }
      });

      return `Imported BYOY JSON from ${byoyPath}`;
    });
  }

  async function loadSlotPreviewMap() {
    const sortedSlots = [...doc.project.slots].sort((a, b) => a.order - b.order);
    const files = await listPngFiles(renderDir);
    const urls: Record<string, string> = {};
    const paths: Record<string, string> = {};

    for (const slot of sortedSlots) {
      const suffix = `${selectedPlatform}/${selectedDevice}/${selectedLocale}/${slot.id}.png`;
      const picked = files.find((entry) => entry.endsWith(suffix));
      if (!picked) continue;

      const base64 = await readFileBase64(picked);
      urls[slot.id] = `data:image/png;base64,${base64}`;
      paths[slot.id] = picked;
    }

    setSlotPreviewUrls(urls);
    setSlotPreviewPaths(paths);

    return {
      loaded: Object.keys(paths).length,
      total: sortedSlots.length,
      selectedPath: paths[selectedSlot] || ''
    };
  }

  async function handleRender() {
    await runWithLog(async () => {
      const output = await runPipeline('render', [projectPath, renderDir]);
      const previewSummary = await loadSlotPreviewMap();
      return `${output}\nLoaded ${previewSummary.loaded}/${previewSummary.total} slot preview(s).`;
    });
  }

  async function handleValidate() {
    await runWithLog(async () => {
      const output = await runPipeline('validate', [projectPath]);
      const parsed = extractJson(output) as { issues?: ValidateIssue[] } | null;
      setIssues(parsed?.issues || []);
      return output;
    });
  }

  async function handleExport() {
    await runWithLog(async () => {
      const flags: string[] = [];
      if (doc.pipelines.export.zip) flags.push('--zip');

      return runPipeline('export', [projectPath, renderDir, outputDir, ...flags]);
    });
  }

  async function handleRefreshPreview() {
    await runWithLog(async () => {
      const previewSummary = await loadSlotPreviewMap();
      if (!previewSummary.selectedPath) {
        return `No preview image found for ${selectedDevice}/${selectedLocale}/${selectedSlot}.`;
      }

      return `Loaded ${previewSummary.loaded}/${previewSummary.total} slot preview(s). Selected: ${selectedSlot}`;
    });
  }

  function handleOpenOnboarding() {
    setIsOnboardingOpen(true);
  }

  function handleCompleteOnboarding() {
    if (!onboardingReady) {
      setLog('Onboarding requires at least 1 locale, 1 platform, and 1 device.');
      return;
    }

    setSelectedLocale((current) => (
      doc.project.locales.includes(current) ? current : doc.project.locales[0]
    ));
    setSelectedDevice((current) => (
      doc.project.devices.some((device) => device.id === current)
        ? current
        : (doc.project.devices[0]?.id || 'ios_phone')
    ));

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }

    setIsOnboardingOpen(false);
    setLog('Onboarding completed.');
  }

  function upsertLlmConfig(mutator: (cfg: LlmCliConfig) => void) {
    updateDoc((next) => {
      next.pipelines.localization.llmCli = next.pipelines.localization.llmCli || clone(defaultLlmConfig);
      mutator(next.pipelines.localization.llmCli);
    });
  }

  const slots = useMemo(
    () => [...doc.project.slots].sort((a, b) => a.order - b.order),
    [doc.project.slots]
  );
  const selectedSlotData = useMemo(
    () => slots.find((slot) => slot.id === selectedSlot) || null,
    [slots, selectedSlot]
  );
  const selectedTitleKey = useMemo(
    () => (selectedSlotData ? fieldKey(selectedSlotData.id, 'title') : ''),
    [selectedSlotData]
  );
  const selectedSubtitleKey = useMemo(
    () => (selectedSlotData ? fieldKey(selectedSlotData.id, 'subtitle') : ''),
    [selectedSlotData]
  );
  const previewPath = slotPreviewPaths[selectedSlot] || '';
  const previewDataUrl = slotPreviewUrls[selectedSlot] || '';
  const onboardingReady = doc.project.locales.length > 0
    && doc.project.platforms.length > 0
    && doc.project.devices.length > 0;

  useEffect(() => {
    setSlotCanvasPositions((current) => {
      const next: Record<string, SlotCanvasPosition> = {};
      let changed = Object.keys(current).length !== slots.length;
      const occupied = new Set<string>();

      for (const [index, slot] of slots.entries()) {
        const existing = current[slot.id];
        if (existing) {
          next[slot.id] = existing;
          occupied.add(`${existing.x}:${existing.y}`);
          continue;
        }

        let candidate = defaultSlotCanvasPosition(index);
        while (occupied.has(`${candidate.x}:${candidate.y}`)) {
          candidate = {
            x: candidate.x + SLOT_CANVAS_CARD_WIDTH + SLOT_CANVAS_GAP_X,
            y: candidate.y
          };
        }

        next[slot.id] = candidate;
        occupied.add(`${candidate.x}:${candidate.y}`);
        changed = true;
      }

      return changed ? next : current;
    });
  }, [slots]);

  const updateSlotCanvasPosition = useCallback((slotId: string, nextPosition: SlotCanvasPosition) => {
    setSlotCanvasPositions((current) => {
      const existing = current[slotId];
      if (existing && existing.x === nextPosition.x && existing.y === nextPosition.y) {
        return current;
      }

      return {
        ...current,
        [slotId]: nextPosition
      };
    });
  }, []);

  const screenCanvasSlots = useMemo<CanvasSlotItem[]>(() => (
    slots.map((slot) => ({
      slot,
      titleValue: doc.copy.keys[fieldKey(slot.id, 'title')]?.[selectedLocale] || '',
      subtitleValue: doc.copy.keys[fieldKey(slot.id, 'subtitle')]?.[selectedLocale] || '',
      renderedPreviewUrl: slotPreviewUrls[slot.id],
      sourceImageUrl: slotSourceUrls[slot.id],
      previewPath: slotPreviewPaths[slot.id] || `${selectedPlatform}/${selectedDevice}/${selectedLocale}/${slot.id}.png`
    }))
  ), [
    doc.copy.keys,
    selectedDevice,
    selectedLocale,
    selectedPlatform,
    slotPreviewPaths,
    slotPreviewUrls,
    slotSourceUrls,
    slots
  ]);

  const updateCopyByKey = useCallback((key: string, locale: string, value: string) => {
    setDoc((current) => {
      const currentLocaleMap = current.copy.keys[key] || {};
      if (currentLocaleMap[locale] === value) {
        return current;
      }

      return {
        ...current,
        copy: {
          ...current.copy,
          keys: {
            ...current.copy.keys,
            [key]: {
              ...currentLocaleMap,
              [locale]: value
            }
          }
        }
      };
    });
  }, []);

  const handleSelectedTitleChange = useCallback((value: string) => {
    if (!selectedTitleKey) return;
    updateCopyByKey(selectedTitleKey, selectedLocale, value);
  }, [selectedLocale, selectedTitleKey, updateCopyByKey]);

  const handleSelectedSubtitleChange = useCallback((value: string) => {
    if (!selectedSubtitleKey) return;
    updateCopyByKey(selectedSubtitleKey, selectedLocale, value);
  }, [selectedLocale, selectedSubtitleKey, updateCopyByKey]);

  const updateTemplateBackground = useCallback((patch: Partial<TemplateMain['background']>) => {
    setDoc((current) => ({
      ...current,
      template: {
        ...current.template,
        main: {
          ...current.template.main,
          background: {
            ...current.template.main.background,
            ...patch
          }
        }
      }
    }));
  }, []);

  const updateTemplateFrame = useCallback((patch: Partial<TemplateMain['frame']>) => {
    setDoc((current) => ({
      ...current,
      template: {
        ...current.template,
        main: {
          ...current.template.main,
          frame: {
            ...current.template.main.frame,
            ...patch
          }
        }
      }
    }));
  }, []);

  const updateTemplateTextBox = useCallback((kind: 'title' | 'subtitle', patch: Partial<TextBox>) => {
    setDoc((current) => ({
      ...current,
      template: {
        ...current.template,
        main: {
          ...current.template.main,
          text: {
            ...current.template.main.text,
            [kind]: {
              ...current.template.main.text[kind],
              ...patch
            }
          }
        }
      }
    }));
  }, []);

  const updateShotPlacement = useCallback((patch: Partial<ShotPlacement>) => {
    setDoc((current) => ({
      ...current,
      template: {
        ...current.template,
        main: {
          ...current.template.main,
          shotPlacement: {
            ...current.template.main.shotPlacement,
            ...patch
          }
        }
      }
    }));
  }, []);

  const handleSelectSlot = useCallback((slotId: string) => {
    startSlotTransition(() => {
      setSelectedSlot(slotId);
    });
  }, [startSlotTransition]);

  const openSlotImagePicker = useCallback((slotId: string) => {
    slotFileTargetRef.current = slotId;
    slotFileInputRef.current?.click();
  }, []);

  async function handleSlotFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const slotId = slotFileTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!slotId || !file) {
      slotFileTargetRef.current = null;
      return;
    }

    const extension = file.name.includes('.')
      ? (file.name.split('.').pop() || 'png').toLowerCase()
      : 'png';
    const normalizedExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
    const outputPath = `examples/assets/source/uploads/${slotId}-${Date.now()}.${normalizedExtension}`;

    try {
      await runWithLog(async () => {
        const base64 = await browserFileToBase64(file);
        const mime = imageMimeTypeFromPath(file.name);
        await writeFileBase64(outputPath, base64);

        updateDoc((next) => {
          const target = next.project.slots.find((item) => item.id === slotId);
          if (target) target.sourceImagePath = outputPath;
        });
        setSlotSourceUrls((current) => ({
          ...current,
          [slotId]: `data:${mime};base64,${base64}`
        }));

        setSlotPreviewUrls((current) => {
          const next = { ...current };
          delete next[slotId];
          return next;
        });
        setSlotPreviewPaths((current) => {
          const next = { ...current };
          delete next[slotId];
          return next;
        });

        return `Selected image for ${slotId}: ${outputPath}`;
      });
    } catch {
      // runWithLog already writes error text into the pipeline log.
    } finally {
      slotFileTargetRef.current = null;
    }
  }

  const templateInspectorSection = useMemo(() => (
    <>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Background / Frame</CardTitle>
          <CardDescription>배경과 프레임 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <LabeledField label="Background Type">
            <Select
              value={doc.template.main.background.type}
              onValueChange={(value) => updateTemplateBackground({ type: value as 'solid' | 'gradient' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">solid</SelectItem>
                <SelectItem value="gradient">gradient</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>

          {doc.template.main.background.type === 'solid' ? (
            <LabeledField label="Color">
              <Input
                value={doc.template.main.background.value || '#111827'}
                onChange={(event) => updateTemplateBackground({ value: event.target.value })}
              />
            </LabeledField>
          ) : (
            <>
              <LabeledField label="From">
                <Input value={doc.template.main.background.from || '#111827'} onChange={(event) => updateTemplateBackground({ from: event.target.value })} />
              </LabeledField>
              <LabeledField label="To">
                <Input value={doc.template.main.background.to || '#1f2937'} onChange={(event) => updateTemplateBackground({ to: event.target.value })} />
              </LabeledField>
              <LabeledField label="Direction">
                <Input value={doc.template.main.background.direction || '180deg'} onChange={(event) => updateTemplateBackground({ direction: event.target.value })} />
              </LabeledField>
            </>
          )}

          <SwitchRow
            label="Enable Frame"
            checked={doc.template.main.frame.enabled}
            onCheckedChange={(checked) => updateTemplateFrame({ enabled: checked })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Frame Inset"
              value={doc.template.main.frame.inset}
              onValueChange={(value) => updateTemplateFrame({ inset: value })}
            />
            <NumberField
              label="Frame Radius"
              value={doc.template.main.frame.radius}
              onValueChange={(value) => updateTemplateFrame({ radius: value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Text / Shot Placement</CardTitle>
          <CardDescription>텍스트 박스와 샷 위치 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateBoxEditor
            title="Title Box"
            box={doc.template.main.text.title}
            fontOptions={availableFonts}
            onChange={(patch) => updateTemplateTextBox('title', patch)}
          />
          <TemplateBoxEditor
            title="Subtitle Box"
            box={doc.template.main.text.subtitle}
            fontOptions={availableFonts}
            onChange={(patch) => updateTemplateTextBox('subtitle', patch)}
          />

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Shot Placement</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="X" value={doc.template.main.shotPlacement.x} onValueChange={(value) => updateShotPlacement({ x: value })} />
              <NumberField label="Y" value={doc.template.main.shotPlacement.y} onValueChange={(value) => updateShotPlacement({ y: value })} />
              <NumberField label="Width" value={doc.template.main.shotPlacement.w} onValueChange={(value) => updateShotPlacement({ w: value })} />
              <NumberField label="Height" value={doc.template.main.shotPlacement.h} onValueChange={(value) => updateShotPlacement({ h: value })} />
              <NumberField label="Corner Radius" value={doc.template.main.shotPlacement.cornerRadius} onValueChange={(value) => updateShotPlacement({ cornerRadius: value })} />
              <LabeledField label="Fit">
                <Select
                  value={doc.template.main.shotPlacement.fit}
                  onValueChange={(value) => updateShotPlacement({ fit: value as 'cover' | 'contain' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">cover</SelectItem>
                    <SelectItem value="contain">contain</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledField>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  ), [
    availableFonts,
    doc.template.main,
    updateShotPlacement,
    updateTemplateBackground,
    updateTemplateFrame,
    updateTemplateTextBox
  ]);

  function renderSelectedInspector() {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Selected Screen Inspector</CardTitle>
            <CardDescription>
              {selectedSlotData ? `${selectedSlotData.id} · ${selectedLocale}` : '선택된 슬롯이 없습니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedSlotData ? (
              <>
                <LabeledField label="Source Image">
                  <p className="truncate rounded-md border bg-muted/60 p-2 text-xs">
                    {selectedSlotData.sourceImagePath}
                  </p>
                </LabeledField>

                <InspectorCopyFields
                  locale={selectedLocale}
                  titleValue={doc.copy.keys[fieldKey(selectedSlotData.id, 'title')]?.[selectedLocale] || ''}
                  subtitleValue={doc.copy.keys[fieldKey(selectedSlotData.id, 'subtitle')]?.[selectedLocale] || ''}
                  onTitleChange={handleSelectedTitleChange}
                  onSubtitleChange={handleSelectedSubtitleChange}
                />

                <p className="rounded-md border bg-muted/60 p-2 text-xs">
                  {slotPreviewPaths[selectedSlotData.id] || `${selectedPlatform}/${selectedDevice}/${selectedLocale}/${selectedSlotData.id}.png`}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSlotImagePicker(selectedSlotData.id)}
                  >
                    Choose Image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={slots[0]?.id === selectedSlotData.id}
                    onClick={() => moveSlot(selectedSlotData.id, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={slots[slots.length - 1]?.id === selectedSlotData.id}
                    onClick={() => moveSlot(selectedSlotData.id, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeSlot(selectedSlotData.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">슬롯을 추가하거나 선택해 주세요.</p>
            )}
          </CardContent>
        </Card>

        {templateInspectorSection}
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full max-w-[1600px] gap-4 p-4 lg:p-6">
      <input
        ref={slotFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => { void handleSlotFileChange(event); }}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="relative">
        <div className="pointer-events-none fixed left-3 top-3 z-40 w-[220px]">
          <div className="pointer-events-auto space-y-2">
            <Card className="border bg-card/95 shadow-xl backdrop-blur">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm tracking-tight">StoreShot Studio</CardTitle>
                <CardDescription className="text-xs">{activeTabDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 pt-0">
                <Button size="sm" disabled={isBusy} variant="outline" onClick={handleLoadProject}><FolderDown className="mr-1 h-3.5 w-3.5" />Load</Button>
                <Button size="sm" disabled={isBusy} variant="outline" onClick={handleSaveProject}><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
                <Button size="sm" disabled={isBusy} onClick={handleCreateNewProject}><FolderUp className="mr-1 h-3.5 w-3.5" />New</Button>
                <Button size="sm" variant="secondary" onClick={handleOpenOnboarding}>Setup</Button>
              </CardContent>
            </Card>

            <TabsList className="flex h-fit w-full flex-col items-stretch gap-1 border bg-card/90 p-1 shadow-xl backdrop-blur">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start">
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className={activeTab === 'screens' ? 'space-y-4' : 'space-y-4 pt-2 lg:pl-[250px]'}>
          {activeTab === 'screens' ? (
            <TabsContent value="screens" className="relative mt-0 h-[calc(100vh-2.5rem)] overflow-hidden rounded-xl border">
              <InfiniteSlotCanvas
                className="h-full w-full"
                focusTrigger={screenFocusTrigger}
                items={screenCanvasSlots}
                positions={slotCanvasPositions}
                selectedSlot={selectedSlot}
                template={doc.template.main}
                device={selectedDeviceSpec}
                onSelect={handleSelectSlot}
                onChooseImage={openSlotImagePicker}
                onPositionChange={updateSlotCanvasPosition}
              />

              <div className="pointer-events-none fixed left-3 top-[13.5rem] z-30 w-[min(560px,calc(100%-1.5rem))] lg:left-[15.5rem] lg:top-3 lg:w-[min(560px,calc(100%-17.5rem))] xl:w-[540px]">
                <Card className="pointer-events-auto bg-card/95 shadow-2xl backdrop-blur">
                  <CardHeader className="gap-3 pb-2">
                    <div className="space-y-2">
                      <CardTitle>Screens Composer</CardTitle>
                      <CardDescription>캔버스 위에서 슬롯을 배치하고 바로 편집합니다.</CardDescription>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{selectedDevice}</Badge>
                        <Badge variant="secondary">{selectedLocale}</Badge>
                        <Badge variant="outline">{slots.length} slots</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={addSlot}><Plus className="mr-1 h-4 w-4" />Add Slot</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-0 sm:grid-cols-3">
                    <LabeledField label="Device">
                      <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {doc.project.devices.map((device) => (
                            <SelectItem key={device.id} value={device.id}>{device.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LabeledField>

                    <LabeledField label="Locale">
                      <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {doc.project.locales.map((locale) => (
                            <SelectItem key={locale} value={locale}>{locale}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LabeledField>

                    <LabeledField label="Selected Slot">
                      <Select value={selectedSlot} onValueChange={handleSelectSlot}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {slots.map((slot) => (
                            <SelectItem key={slot.id} value={slot.id}>{slot.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LabeledField>
                  </CardContent>
                </Card>
              </div>

              {isXlLayout ? (
                <div className="pointer-events-none fixed right-3 top-3 z-30 w-[460px]">
                  <div className="pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
                    <ScrollArea className="h-[calc(100vh-8rem)] pr-2">
                      {renderSelectedInspector()}
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30">
                  <div className="pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
                    <ScrollArea className="h-[42vh] pr-2">
                      {renderSelectedInspector()}
                    </ScrollArea>
                  </div>
                </div>
              )}
            </TabsContent>
          ) : null}

          {activeTab === 'localization' ? (
            <TabsContent value="localization" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Localization Pipeline</CardTitle>
                  <CardDescription>BYOY import 또는 LLM CLI 설정</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LabeledField label="Mode">
                    <Select
                      value={doc.pipelines.localization.mode}
                      onValueChange={(value) => updateDoc((next) => {
                        next.pipelines.localization.mode = value as 'byoy' | 'llm-cli';
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="byoy">BYOY</SelectItem>
                        <SelectItem value="llm-cli">LLM CLI</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledField>

                  <LabeledField label="BYOY JSON Path">
                    <Input value={byoyPath} onChange={(event) => setByoyPath(event.target.value)} />
                  </LabeledField>
                  <Button variant="outline" disabled={isBusy} onClick={handleImportByoy}>Import BYOY JSON</Button>

                  <div className="rounded-md border p-3">
                    <p className="mb-3 text-sm font-medium">LLM CLI Config</p>
                    <div className="grid gap-3">
                      <LabeledField label="Command">
                        <Input value={llmConfig.command} onChange={(event) => upsertLlmConfig((cfg) => { cfg.command = event.target.value; })} />
                      </LabeledField>
                      <LabeledField label="Args Template (comma separated)">
                        <Input
                          value={llmConfig.argsTemplate.join(', ')}
                          onChange={(event) => upsertLlmConfig((cfg) => {
                            cfg.argsTemplate = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
                          })}
                        />
                      </LabeledField>
                      <NumberField
                        label="Timeout Sec"
                        value={llmConfig.timeoutSec}
                        onValueChange={(value) => upsertLlmConfig((cfg) => { cfg.timeoutSec = value; })}
                      />
                      <LabeledField label="Glossary Path">
                        <Input value={llmConfig.glossaryPath || ''} onChange={(event) => upsertLlmConfig((cfg) => { cfg.glossaryPath = event.target.value; })} />
                      </LabeledField>
                      <LabeledField label="Style Guide Path">
                        <Input value={llmConfig.styleGuidePath || ''} onChange={(event) => upsertLlmConfig((cfg) => { cfg.styleGuidePath = event.target.value; })} />
                      </LabeledField>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Copy Editor</CardTitle>
                  <CardDescription>{doc.project.locales.length} locale(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[520px] pr-2">
                    <div className="space-y-2">
                      {copyKeys.map((key) => (
                        <div key={key} className="rounded-md border p-3">
                          <p className="mb-2 text-xs font-semibold text-muted-foreground">{key}</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            {doc.project.locales.map((locale) => (
                              <LabeledField key={`${key}:${locale}`} label={locale}>
                                <Input
                                  value={doc.copy.keys[key]?.[locale] || ''}
                                  onChange={(event) => updateCopyByKey(key, locale, event.target.value)}
                                />
                              </LabeledField>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            </TabsContent>
          ) : null}

          {activeTab === 'preview' ? (
            <TabsContent value="preview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Render Controls</CardTitle>
                  <CardDescription>렌더/검증/프리뷰 로드</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LabeledField label="Device">
                    <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {doc.project.devices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>{device.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>

                  <LabeledField label="Locale">
                    <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {doc.project.locales.map((locale) => (
                          <SelectItem key={locale} value={locale}>{locale}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>

                  <LabeledField label="Slot">
                    <Select value={selectedSlot} onValueChange={handleSelectSlot}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {doc.project.slots.map((slot) => (
                          <SelectItem key={slot.id} value={slot.id}>{slot.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isBusy} onClick={handleRender}>Render</Button>
                    <Button disabled={isBusy} variant="outline" onClick={handleValidate}>Validate</Button>
                    <Button disabled={isBusy} variant="secondary" onClick={handleRefreshPreview}><RefreshCcw className="mr-1 h-4 w-4" />Refresh</Button>
                  </div>

                  <p className="rounded-md border bg-muted/60 p-2 text-xs">{expectedPreviewPath}</p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Validation Issues</p>
                    {issues.length === 0 ? (
                      <Badge variant="secondary">No issues</Badge>
                    ) : (
                      <div className="grid gap-2">
                        {issues.map((issue, index) => (
                          <div key={`${issue.code}:${index}`} className="rounded-md border p-2">
                            <Badge variant={issue.level === 'error' ? 'destructive' : 'outline'}>
                              {issue.level.toUpperCase()} · {issue.code}
                            </Badge>
                            <p className="mt-1 text-xs text-muted-foreground">{issue.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription className="truncate">{previewPath || 'No image loaded'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid min-h-[560px] place-items-center rounded-lg border bg-muted/30 p-4">
                    {previewDataUrl ? (
                      <img src={previewDataUrl} alt="render preview" className="max-h-[72vh] w-auto max-w-full rounded-md border" />
                    ) : (
                      <p className="text-sm text-muted-foreground">Render 후 Refresh Preview를 눌러 주세요.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            </TabsContent>
          ) : null}

          {activeTab === 'export' ? (
            <TabsContent value="export" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Export</CardTitle>
                  <CardDescription>dist/zip layout 생성</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LabeledField label="Output Dir">
                    <Input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
                  </LabeledField>

                  <SwitchRow
                    label="Create zip"
                    checked={doc.pipelines.export.zip}
                    onCheckedChange={(checked) => updateDoc((next) => { next.pipelines.export.zip = checked; })}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isBusy} onClick={handleExport}>Run Export</Button>
                  </div>

                  <p className="rounded-md border bg-muted/60 p-2 text-xs">Render Dir: {renderDir}</p>
                </CardContent>
              </Card>
            </div>
            </TabsContent>
          ) : null}

        </div>
      </Tabs>

      {isOnboardingOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-[760px] shadow-2xl">
            <CardHeader>
              <CardTitle>Welcome to StoreShot Studio</CardTitle>
              <CardDescription>첫 실행 설정입니다. 로케일/플랫폼/디바이스를 먼저 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Locales</p>
                <LocaleSelector
                  value={doc.project.locales}
                  options={localePresets}
                  onChange={(locales) => updateDoc((next) => { next.project.locales = locales; })}
                />
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Platforms & Devices</p>
                <SwitchRow
                  label="iOS"
                  checked={doc.project.platforms.includes('ios')}
                  onCheckedChange={(checked) => togglePlatform('ios', checked)}
                />
                <SwitchRow
                  label="Android"
                  checked={doc.project.platforms.includes('android')}
                  onCheckedChange={(checked) => togglePlatform('android', checked)}
                />
                <div className="space-y-1.5 rounded-md border p-1.5">
                  {devicePresets.map((preset) => (
                    <SwitchRow
                      key={preset.value.id}
                      label={preset.label}
                      checked={doc.project.devices.some((device) => device.id === preset.value.id)}
                      onCheckedChange={(checked) => toggleDevicePreset(preset.value, checked)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {onboardingReady ? 'Ready to start.' : '최소 1개 locale, 1개 platform, 1개 device가 필요합니다.'}
                </p>
                <Button disabled={!onboardingReady} onClick={handleCompleteOnboarding}>
                  Start
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

interface LabeledFieldProps {
  label: string;
  children: React.ReactNode;
}

function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SwitchRow({ label, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
}

function NumberField({ label, value, onValueChange }: NumberFieldProps) {
  return (
    <LabeledField label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </LabeledField>
  );
}

interface TemplateBoxEditorProps {
  title: string;
  box: TextBox;
  fontOptions: string[];
  onChange: (patch: Partial<TextBox>) => void;
}

interface LocaleSelectorProps {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}

interface InspectorCopyFieldsProps {
  locale: string;
  titleValue: string;
  subtitleValue: string;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
}

const InspectorCopyFields = memo(function InspectorCopyFields({
  locale,
  titleValue,
  subtitleValue,
  onTitleChange,
  onSubtitleChange
}: InspectorCopyFieldsProps) {
  const [titleDraft, setTitleDraft] = useState(titleValue);
  const [subtitleDraft, setSubtitleDraft] = useState(subtitleValue);

  useEffect(() => {
    setTitleDraft(titleValue);
  }, [titleValue]);

  useEffect(() => {
    setSubtitleDraft(subtitleValue);
  }, [subtitleValue]);

  useEffect(() => {
    if (titleDraft === titleValue) return;
    const timer = window.setTimeout(() => {
      onTitleChange(titleDraft);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onTitleChange, titleDraft, titleValue]);

  useEffect(() => {
    if (subtitleDraft === subtitleValue) return;
    const timer = window.setTimeout(() => {
      onSubtitleChange(subtitleDraft);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onSubtitleChange, subtitleDraft, subtitleValue]);

  return (
    <>
      <LabeledField label={`Title (${locale})`}>
        <Input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
        />
      </LabeledField>

      <LabeledField label={`Subtitle (${locale})`}>
        <Textarea
          value={subtitleDraft}
          onChange={(event) => setSubtitleDraft(event.target.value)}
          className="min-h-[92px]"
        />
      </LabeledField>
    </>
  );
});

function TemplateBoxEditor({ title, box, fontOptions, onChange }: TemplateBoxEditorProps) {
  const mergedFonts = useMemo(() => {
    const unique = new Set<string>();
    for (const font of fontOptions) {
      const trimmed = font.trim();
      if (trimmed) unique.add(trimmed);
    }

    const current = box.font.trim();
    if (current) unique.add(current);

    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [box.font, fontOptions]);

  const selectedFont = box.font.trim() || mergedFonts[0] || 'SF Pro';

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="X" value={box.x} onValueChange={(value) => onChange({ x: value })} />
        <NumberField label="Y" value={box.y} onValueChange={(value) => onChange({ y: value })} />
        <NumberField label="Width" value={box.w} onValueChange={(value) => onChange({ w: value })} />
        <NumberField label="Height" value={box.h} onValueChange={(value) => onChange({ h: value })} />
        <LabeledField label="Font">
          <Select value={selectedFont} onValueChange={(value) => onChange({ font: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {mergedFonts.map((font) => (
                <SelectItem key={font} value={font}>{font}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <NumberField label="Size" value={box.size} onValueChange={(value) => onChange({ size: value })} />
        <NumberField label="Weight" value={box.weight} onValueChange={(value) => onChange({ weight: value })} />
        <LabeledField label="Align">
          <Select value={box.align} onValueChange={(value) => onChange({ align: value as Align })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">left</SelectItem>
              <SelectItem value="center">center</SelectItem>
              <SelectItem value="right">right</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
      </div>
    </div>
  );
}

function LocaleSelector({ value, options, onChange }: LocaleSelectorProps) {
  const [search, setSearch] = useState('');
  const [customLocale, setCustomLocale] = useState('');
  const merged = useMemo(
    () => [...new Set([...options, ...value])].sort((a, b) => a.localeCompare(b)),
    [options, value]
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return merged;
    return merged.filter((locale) => locale.toLowerCase().includes(query));
  }, [merged, search]);

  const label = value.length === 0
    ? 'Select locales'
    : `${value.length} locale(s) selected`;

  function addCustomLocale() {
    const normalized = normalizeLocaleTag(customLocale);
    if (!normalized) return;
    if (!value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setCustomLocale('');
  }

  return (
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
        <div className="mb-2 grid gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search locales"
            className="h-8"
          />
          <div className="flex gap-2">
            <Input
              value={customLocale}
              onChange={(event) => setCustomLocale(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustomLocale();
                }
              }}
              placeholder="Add locale (e.g. es-MX)"
              className="h-8"
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustomLocale}>
              Add
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-56 pr-2">
          <div className="grid gap-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No locale found.</p>
            ) : null}

            {filtered.map((locale) => {
              const checked = value.includes(locale);
              return (
                <label key={locale} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange([...value, locale]);
                        return;
                      }

                      if (value.length <= 1) {
                        return;
                      }

                      onChange(value.filter((entry) => entry !== locale));
                    }}
                  />
                  <span className="text-sm">{locale}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </details>
  );
}

interface CanvasSlotItem {
  slot: Slot;
  titleValue: string;
  subtitleValue: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  previewPath: string;
}

interface InfiniteSlotCanvasProps {
  className?: string;
  focusTrigger?: number;
  items: CanvasSlotItem[];
  positions: Record<string, SlotCanvasPosition>;
  selectedSlot: string;
  template: TemplateMain;
  device: Device;
  onSelect: (slotId: string) => void;
  onChooseImage: (slotId: string) => void;
  onPositionChange: (slotId: string, nextPosition: SlotCanvasPosition) => void;
}

const InfiniteSlotCanvas = memo(function InfiniteSlotCanvas({
  className,
  focusTrigger,
  items,
  positions,
  selectedSlot,
  template,
  device,
  onSelect,
  onChooseImage,
  onPositionChange
}: InfiniteSlotCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedSlotRef = useRef(selectedSlot);
  const zoomRef = useRef(1);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const dragRef = useRef<{
    slotId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const spacePanRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [inputDebug, setInputDebug] = useState({
    wheelCount: 0,
    panCount: 0,
    last: 'idle'
  });

  const clampZoom = useCallback((value: number) => {
    return Math.min(SLOT_CANVAS_MAX_ZOOM, Math.max(SLOT_CANVAS_MIN_ZOOM, value));
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const boardStyle = useMemo<CSSProperties>(() => ({
    backgroundImage: [
      'linear-gradient(to right, rgba(100,116,139,0.16) 1px, transparent 1px)',
      'linear-gradient(to bottom, rgba(100,116,139,0.16) 1px, transparent 1px)',
      'linear-gradient(to right, rgba(71,85,105,0.28) 1px, transparent 1px)',
      'linear-gradient(to bottom, rgba(71,85,105,0.28) 1px, transparent 1px)'
    ].join(','),
    backgroundSize: '40px 40px, 40px 40px, 200px 200px, 200px 200px',
    backgroundPosition: '0 0, 0 0, 0 0, 0 0'
  }), []);

  const scaledBoardOuterStyle = useMemo<CSSProperties>(() => ({
    width: SLOT_CANVAS_WIDTH * zoom,
    height: SLOT_CANVAS_HEIGHT * zoom
  }), [zoom]);

  const scaledBoardInnerStyle = useMemo<CSSProperties>(() => ({
    ...boardStyle,
    width: SLOT_CANVAS_WIDTH,
    height: SLOT_CANVAS_HEIGHT,
    transformOrigin: 'top left',
    transform: `scale(${zoom})`
  }), [boardStyle, zoom]);

  const focusViewportOnSlots = useCallback((behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport || items.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const [index, item] of items.entries()) {
      const position = positions[item.slot.id] || defaultSlotCanvasPosition(index);
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + SLOT_CANVAS_CARD_WIDTH);
      maxY = Math.max(maxY, position.y + SLOT_CANVAS_CARD_HEIGHT);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const centerX = ((minX + maxX) / 2) * zoomRef.current;
    const centerY = ((minY + maxY) / 2) * zoomRef.current;

    viewport.scrollTo({
      left: Math.max(0, centerX - viewport.clientWidth / 2),
      top: Math.max(0, centerY - viewport.clientHeight / 2),
      behavior
    });
  }, [items, positions]);

  const applyZoomAtPoint = useCallback((nextZoomValue: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(nextZoomValue);
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const worldX = (viewport.scrollLeft + pointX) / currentZoom;
    const worldY = (viewport.scrollTop + pointY) / currentZoom;

    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;
      currentViewport.scrollLeft = Math.max(0, worldX * nextZoom - pointX);
      currentViewport.scrollTop = Math.max(0, worldY * nextZoom - pointY);
    });
  }, [clampZoom]);

  const pickViewportCenterAnchor = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
  }, []);

  const resolveWheelAnchor = useCallback((clientXInput: number, clientYInput: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const isInside = (x: number, y: number) => (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );

    let clientX = clientXInput;
    let clientY = clientYInput;

    if (!isInside(clientX, clientY) || (clientX === 0 && clientY === 0)) {
      const pointer = pointerRef.current;
      if (pointer && isInside(pointer.clientX, pointer.clientY)) {
        clientX = pointer.clientX;
        clientY = pointer.clientY;
      } else {
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }
    }

    return { clientX, clientY };
  }, []);

  const rememberPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY
    };
  }, []);

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      const anchor = resolveWheelAnchor(event.clientX, event.clientY);
      if (!anchor) return;

      const factor = Math.exp((-event.deltaY * 1.5) / 1000);
      applyZoomAtPoint(zoomRef.current * factor, anchor.clientX, anchor.clientY);
      return;
    }

    // Normalize wheel units so trackpads/mice behave consistently.
    const unitScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? viewport.clientHeight
        : 1;

    let rawX = event.deltaX * unitScale;
    let rawY = event.deltaY * unitScale;

    // WebKit fallback for environments where deltaX may be zeroed.
    const legacyEvent = event as WheelEvent & { wheelDeltaX?: number; wheelDeltaY?: number };
    if (Math.abs(rawX) < 0.01 && typeof legacyEvent.wheelDeltaX === 'number' && legacyEvent.wheelDeltaX !== 0) {
      rawX = -legacyEvent.wheelDeltaX;
    }
    if (Math.abs(rawY) < 0.01 && typeof legacyEvent.wheelDeltaY === 'number' && legacyEvent.wheelDeltaY !== 0) {
      rawY = -legacyEvent.wheelDeltaY;
    }
    const horizontalRaw = event.shiftKey && Math.abs(rawX) < 0.01 ? rawY : rawX;
    const verticalRaw = event.shiftKey && Math.abs(rawX) < 0.01 ? 0 : rawY;
    const normalizeWheelStep = (value: number) => {
      if (Math.abs(value) < 0.01) return 0;
      if (Math.abs(value) < 1) return Math.sign(value);
      return value;
    };
    const horizontal = normalizeWheelStep(horizontalRaw);
    const vertical = normalizeWheelStep(verticalRaw);

    if (Math.abs(horizontal) < 0.01 && Math.abs(vertical) < 0.01) return;

    const beforeLeft = viewport.scrollLeft;
    const beforeTop = viewport.scrollTop;
    event.preventDefault();
    event.stopPropagation();
    viewport.scrollLeft += horizontal;
    viewport.scrollTop += vertical;
    const afterLeft = viewport.scrollLeft;
    const afterTop = viewport.scrollTop;
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    setInputDebug((prev) => ({
      ...prev,
      wheelCount: prev.wheelCount + 1,
      last: `wheel dx:${horizontal.toFixed(1)} dy:${vertical.toFixed(1)} x:${Math.round(beforeLeft)}>${Math.round(afterLeft)}/${Math.round(maxX)} y:${Math.round(beforeTop)}>${Math.round(afterTop)}/${Math.round(maxY)}`
    }));
  }, [applyZoomAtPoint, resolveWheelAnchor]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const viewportListener = (event: WheelEvent) => {
      handleCanvasWheel(event);
    };
    const windowFallbackListener = (event: WheelEvent) => {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;

      const target = event.target;
      const targetInsideViewport = target instanceof Node && currentViewport.contains(target);
      if (targetInsideViewport) {
        handleCanvasWheel(event);
        return;
      }

      const rect = currentViewport.getBoundingClientRect();
      const eventInsideViewport = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;

      if (eventInsideViewport) {
        handleCanvasWheel(event);
        return;
      }

      if (event.clientX === 0 && event.clientY === 0) {
        const pointer = pointerRef.current;
        if (!pointer) return;
        const pointerInsideViewport = pointer.clientX >= rect.left
          && pointer.clientX <= rect.right
          && pointer.clientY >= rect.top
          && pointer.clientY <= rect.bottom;
        if (!pointerInsideViewport) return;
        handleCanvasWheel(event);
      }
    };

    viewport.addEventListener('wheel', viewportListener, { passive: false, capture: true });
    window.addEventListener('wheel', windowFallbackListener, { passive: false, capture: true });
    return () => {
      viewport.removeEventListener('wheel', viewportListener, { capture: true });
      window.removeEventListener('wheel', windowFallbackListener, { capture: true });
    };
  }, [handleCanvasWheel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePanRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePanRef.current = false;
      }
    };
    const handleBlur = () => {
      spacePanRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleZoomOut = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(zoomRef.current * 0.9, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const handleZoomIn = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(zoomRef.current * 1.1, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const handleZoomReset = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(1, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const readPinch = useCallback((touches: ReactTouchEvent<HTMLDivElement>['touches']) => {
    if (touches.length < 2) return null;
    const t0 = touches[0];
    const t1 = touches[1];
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    const distance = Math.hypot(dx, dy);
    const centerX = (t0.clientX + t1.clientX) / 2;
    const centerY = (t0.clientY + t1.clientY) / 2;
    return { distance, centerX, centerY };
  }, []);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = {
      startDistance: pinch.distance,
      startZoom: zoomRef.current
    };
  }, [readPinch]);

  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch || !pinchRef.current) return;

    event.preventDefault();
    const scale = pinch.distance / pinchRef.current.startDistance;
    const nextZoom = pinchRef.current.startZoom * scale;
    applyZoomAtPoint(nextZoom, pinch.centerX, pinch.centerY);
  }, [applyZoomAtPoint, readPinch]);

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = {
      startDistance: pinch.distance,
      startZoom: zoomRef.current
    };
  }, [readPinch]);

  const handleDragPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>, slotId: string) => {
    if (event.button !== 0) return;

    const origin = positions[slotId];
    if (!origin) return;

    dragRef.current = {
      slotId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: origin.x,
      originY: origin.y
    };

    onSelect(slotId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [onSelect, positions]);

  const handleDragPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const currentZoom = zoomRef.current;
    const nextX = Math.round(state.originX + ((event.clientX - state.startClientX) / currentZoom));
    const nextY = Math.round(state.originY + ((event.clientY - state.startClientY) / currentZoom));
    const boundedX = Math.max(0, Math.min(SLOT_CANVAS_WIDTH - SLOT_CANVAS_CARD_WIDTH, nextX));
    const boundedY = Math.max(0, Math.min(SLOT_CANVAS_HEIGHT - SLOT_CANVAS_CARD_HEIGHT, nextY));
    onPositionChange(state.slotId, { x: boundedX, y: boundedY });
  }, [onPositionChange]);

  const handleDragPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    const isInteractive = Boolean(target?.closest('button, input, textarea, select, [role="button"], [contenteditable="true"]'));
    const isOverSlotCard = Boolean(target?.closest('[data-slot-card]'));
    const allowPanByModifier = event.button === 1 || event.altKey || spacePanRef.current;
    if (isInteractive && !allowPanByModifier) return;
    if (isOverSlotCard && !allowPanByModifier) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: viewport.scrollLeft,
      startTop: viewport.scrollTop
    };

    setInputDebug((prev) => ({
      ...prev,
      panCount: prev.panCount + 1,
      last: `pan-start x:${Math.round(viewport.scrollLeft)} y:${Math.round(viewport.scrollTop)}`
    }));

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const beforeLeft = viewport.scrollLeft;
    const beforeTop = viewport.scrollTop;
    viewport.scrollLeft = state.startLeft - (event.clientX - state.startClientX);
    viewport.scrollTop = state.startTop - (event.clientY - state.startClientY);
    const afterLeft = viewport.scrollLeft;
    const afterTop = viewport.scrollTop;
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    setInputDebug((prev) => ({
      ...prev,
      last: `pan-move x:${Math.round(beforeLeft)}>${Math.round(afterLeft)}/${Math.round(maxX)} y:${Math.round(beforeTop)}>${Math.round(afterTop)}/${Math.round(maxY)}`
    }));
    event.preventDefault();
  }, []);

  const handleViewportPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const viewport = viewportRef.current;
    if (viewport) {
      setInputDebug((prev) => ({
        ...prev,
        last: `pan-end x:${Math.round(viewport.scrollLeft)} y:${Math.round(viewport.scrollTop)}`
      }));
    }
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (delayMs: number) => {
      const timerId = window.setTimeout(() => {
        focusViewportOnSlots('auto');
      }, delayMs);
      timers.push(timerId);
    };

    schedule(0);
    schedule(90);
    schedule(220);

    return () => {
      for (const timerId of timers) {
        window.clearTimeout(timerId);
      }
    };
  }, [focusTrigger, focusViewportOnSlots]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const previous = selectedSlotRef.current;
    selectedSlotRef.current = selectedSlot;
    if (previous === selectedSlot) return;

    const position = positions[selectedSlot];
    if (!position) return;

    const left = viewport.scrollLeft;
    const top = viewport.scrollTop;
    const right = left + viewport.clientWidth;
    const bottom = top + viewport.clientHeight;
    const scaledX = position.x * zoomRef.current;
    const scaledY = position.y * zoomRef.current;
    const scaledWidth = SLOT_CANVAS_CARD_WIDTH * zoomRef.current;
    const scaledHeight = SLOT_CANVAS_CARD_HEIGHT * zoomRef.current;
    const nodeLeft = scaledX;
    const nodeTop = scaledY;
    const nodeRight = scaledX + scaledWidth;
    const nodeBottom = scaledY + scaledHeight;

    const margin = 120;
    const visible = nodeLeft >= left + margin
      && nodeRight <= right - margin
      && nodeTop >= top + margin
      && nodeBottom <= bottom - margin;

    if (visible) return;

    viewport.scrollTo({
      left: Math.max(0, nodeLeft - viewport.clientWidth / 2 + scaledWidth / 2),
      top: Math.max(0, nodeTop - viewport.clientHeight / 2 + scaledHeight / 2),
      behavior: 'smooth'
    });
  }, [positions, selectedSlot, zoom]);

  const viewportClassName = className
    ? `relative overflow-x-scroll overflow-y-scroll overscroll-none ${className}`
    : 'relative h-[78vh] overflow-x-scroll overflow-y-scroll overscroll-none rounded-md border bg-muted/20';

  return (
    <div
      ref={viewportRef}
      className={viewportClassName}
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      onPointerDown={handleViewportPointerDown}
      onPointerUp={handleViewportPointerEnd}
      onPointerCancel={handleViewportPointerEnd}
      onPointerMove={rememberPointer}
      onPointerMoveCapture={handleViewportPointerMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="relative" style={scaledBoardOuterStyle}>
        <div className="absolute left-0 top-0" style={scaledBoardInnerStyle}>
          {items.map((item, index) => {
            const position = positions[item.slot.id] || defaultSlotCanvasPosition(index);

            return (
              <div
                key={item.slot.id}
                data-slot-card
                className="absolute w-[540px]"
                style={{ left: position.x, top: position.y }}
              >
                <div className="mb-2 flex items-center justify-between rounded-md border bg-card/90 px-2 py-1 text-[11px] shadow-sm backdrop-blur">
                  <button
                    type="button"
                    className="cursor-grab rounded px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-muted/80 active:cursor-grabbing"
                    onPointerDown={(event) => handleDragPointerDown(event, item.slot.id)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerEnd}
                    onPointerCancel={handleDragPointerEnd}
                  >
                    Drag
                  </button>
                  <span className="font-mono text-muted-foreground">{position.x}, {position.y}</span>
                </div>

                <SlotCard
                  slot={item.slot}
                  selected={selectedSlot === item.slot.id}
                  titleValue={item.titleValue}
                  subtitleValue={item.subtitleValue}
                  renderedPreviewUrl={item.renderedPreviewUrl}
                  sourceImageUrl={item.sourceImageUrl}
                  previewPath={item.previewPath}
                  template={template}
                  device={device}
                  onSelect={onSelect}
                  onChooseImage={onChooseImage}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur">
          <Button type="button" size="sm" variant="outline" onClick={handleZoomOut}>-</Button>
          <Button type="button" size="sm" variant="outline" onClick={handleZoomIn}>+</Button>
          <Button type="button" size="sm" variant="outline" onClick={handleZoomReset}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => focusViewportOnSlots('smooth')}>
            Fit
          </Button>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-3 left-3 z-40 rounded-md border bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground shadow">
        wheel:{inputDebug.wheelCount} pan:{inputDebug.panCount} {inputDebug.last}
      </div>
    </div>
  );
});

interface SlotCardProps {
  slot: Slot;
  selected: boolean;
  titleValue: string;
  subtitleValue: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  previewPath: string;
  template: TemplateMain;
  device: Device;
  onSelect: (slotId: string) => void;
  onChooseImage: (slotId: string) => void;
}

const SlotCard = memo(function SlotCard({
  slot,
  selected,
  titleValue,
  subtitleValue,
  renderedPreviewUrl,
  sourceImageUrl,
  previewPath,
  template,
  device,
  onSelect,
  onChooseImage
}: SlotCardProps) {
  return (
    <Card className={selected ? 'border-primary/60 ring-1 ring-ring' : 'border-dashed'}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{slot.id}</CardTitle>
          <CardDescription>order {slot.order}</CardDescription>
        </div>
        <Button
          size="sm"
          variant={selected ? 'secondary' : 'outline'}
          onClick={() => onSelect(slot.id)}
        >
          Select
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          className="grid min-h-[420px] w-full place-items-center rounded-md border bg-muted/30 p-3"
          onClick={() => onSelect(slot.id)}
          type="button"
        >
          <SlotRenderPreview
            slotId={slot.id}
            title={titleValue}
            subtitle={subtitleValue}
            renderedPreviewUrl={renderedPreviewUrl}
            sourceImageUrl={sourceImageUrl}
            template={template}
            device={device}
          />
        </button>

        <div className="space-y-1 rounded-md border bg-background/60 p-2">
          <p className="truncate text-xs font-medium">{titleValue || '(title empty)'}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitleValue || '(subtitle empty)'}</p>
        </div>

        <p className="truncate text-[11px] text-muted-foreground">{previewPath}</p>

        <Button size="sm" variant="outline" onClick={() => onChooseImage(slot.id)}>
          Choose Image
        </Button>
      </CardContent>
    </Card>
  );
}, (prev, next) => (
  prev.slot === next.slot
  && prev.selected === next.selected
  && prev.titleValue === next.titleValue
  && prev.subtitleValue === next.subtitleValue
  && prev.renderedPreviewUrl === next.renderedPreviewUrl
  && prev.sourceImageUrl === next.sourceImageUrl
  && prev.previewPath === next.previewPath
  && prev.template === next.template
  && prev.device === next.device
  && prev.onSelect === next.onSelect
  && prev.onChooseImage === next.onChooseImage
));

interface SlotRenderPreviewProps {
  slotId: string;
  title: string;
  subtitle: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  template: TemplateMain;
  device: Device;
}

const previewImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadPreviewImage(src: string) {
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

function drawRoundedRectPath(
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

function drawCheckerPattern(
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

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  const lines: string[] = [];
  let truncated = false;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }

    let current = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${current} ${words[index]}`;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[index];
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      }
    }

    if (!truncated) {
      lines.push(current);
      if (lines.length >= maxLines) {
        truncated = true;
      }
    }

    if (truncated) break;
  }

  const fitted = lines.slice(0, maxLines);
  if (truncated && fitted.length > 0) {
    const lastIndex = fitted.length - 1;
    let last = fitted[lastIndex];
    while (last && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    fitted[lastIndex] = `${last}…`;
  }

  return fitted;
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  box: TextBox,
  text: string
) {
  const size = Math.max(1, box.size || 48);
  const weight = box.weight || 600;
  const family = box.font || 'SF Pro';
  const lineHeight = size * 1.2;
  const maxLines = Math.max(1, Math.floor(box.h / lineHeight));

  context.save();
  context.beginPath();
  context.rect(box.x, box.y, box.w, box.h);
  context.clip();

  context.font = `${weight} ${size}px "${family}", "Apple SD Gothic Neo", sans-serif`;
  context.fillStyle = '#f9fafb';
  context.textBaseline = 'top';
  context.textAlign = box.align === 'center' ? 'center' : box.align === 'right' ? 'right' : 'left';
  context.shadowColor = 'rgba(0,0,0,0.2)';
  context.shadowBlur = Math.max(1, Math.round(size * 0.2));
  context.shadowOffsetX = 0;
  context.shadowOffsetY = Math.max(1, Math.round(size * 0.05));

  const lines = wrapLines(context, text, box.w, maxLines);
  let y = box.y;
  for (const line of lines) {
    if (y + lineHeight > box.y + box.h + 1) break;
    const x = box.align === 'center'
      ? box.x + box.w / 2
      : box.align === 'right'
        ? box.x + box.w
        : box.x;
    context.fillText(line, x, y);
    y += lineHeight;
  }

  context.restore();
}

const SlotRenderPreview = memo(function SlotRenderPreview({
  slotId,
  title,
  subtitle,
  renderedPreviewUrl,
  sourceImageUrl,
  template,
  device
}: SlotRenderPreviewProps) {
  if (renderedPreviewUrl) {
      return (
        <img
          src={renderedPreviewUrl}
          alt={`${slotId} preview`}
          className="max-h-[400px] w-auto max-w-full rounded-md border"
        />
      );
    }

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function drawToCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = Math.max(1, device.width || 1290);
      const height = Math.max(1, device.height || 2796);
      const renderScale = Math.min(1, 720 / height);
      const canvasWidth = Math.max(1, Math.round(width * renderScale));
      const canvasHeight = Math.max(1, Math.round(height * renderScale));
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(renderScale, renderScale);

      if (template.background.type === 'gradient') {
        const parsed = Number.parseFloat(template.background.direction || '180');
        const degrees = Number.isFinite(parsed) ? parsed : 180;
        const radians = (degrees * Math.PI) / 180;
        const dx = Math.sin(radians);
        const dy = -Math.cos(radians);
        const x1 = width / 2 - dx * width / 2;
        const y1 = height / 2 - dy * height / 2;
        const x2 = width / 2 + dx * width / 2;
        const y2 = height / 2 + dy * height / 2;
        const gradient = context.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, template.background.from || '#111827');
        gradient.addColorStop(1, template.background.to || '#030712');
        context.fillStyle = gradient;
      } else {
        context.fillStyle = template.background.value || '#111827';
      }
      context.fillRect(0, 0, width, height);

      const frame = template.frame;
      if (frame.enabled) {
        context.save();
        drawRoundedRectPath(
          context,
          frame.inset,
          frame.inset,
          Math.max(0, width - frame.inset * 2),
          Math.max(0, height - frame.inset * 2),
          frame.radius
        );
        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.lineWidth = 3;
        context.stroke();
        context.restore();
      }

      const shot = template.shotPlacement;
      context.save();
      drawRoundedRectPath(context, shot.x, shot.y, shot.w, shot.h, shot.cornerRadius || 0);
      context.fillStyle = 'rgba(15,23,42,0.7)';
      context.fill();
      context.restore();

      if (sourceImageUrl) {
        try {
          const image = await loadPreviewImage(sourceImageUrl);
          if (cancelled) return;

          const imageWidth = Math.max(1, image.naturalWidth || image.width);
          const imageHeight = Math.max(1, image.naturalHeight || image.height);
          const scale = shot.fit === 'contain'
            ? Math.min(shot.w / imageWidth, shot.h / imageHeight)
            : Math.max(shot.w / imageWidth, shot.h / imageHeight);
          const drawWidth = imageWidth * scale;
          const drawHeight = imageHeight * scale;
          const drawX = shot.x + (shot.w - drawWidth) / 2;
          const drawY = shot.y + (shot.h - drawHeight) / 2;

          context.save();
          drawRoundedRectPath(context, shot.x, shot.y, shot.w, shot.h, shot.cornerRadius || 0);
          context.clip();
          context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
          context.restore();
        } catch {
          drawCheckerPattern(context, shot.x, shot.y, shot.w, shot.h, 28);
        }
      } else {
        context.save();
        drawRoundedRectPath(context, shot.x, shot.y, shot.w, shot.h, shot.cornerRadius || 0);
        context.clip();
        drawCheckerPattern(context, shot.x, shot.y, shot.w, shot.h, 28);
        context.restore();

        context.save();
        context.fillStyle = '#475569';
        context.font = `${Math.max(20, Math.round(width * 0.024))}px "SF Pro", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Select image', shot.x + shot.w / 2, shot.y + shot.h / 2);
        context.restore();
      }

      drawTextBlock(context, template.text.title, title);
      drawTextBlock(context, template.text.subtitle, subtitle);
    }

    void drawToCanvas();
    return () => {
      cancelled = true;
    };
  }, [device.height, device.width, sourceImageUrl, subtitle, template, title]);

  return (
    <canvas
      ref={canvasRef}
      className="max-h-[400px] w-auto max-w-full rounded-md border"
      role="img"
      aria-label={`${slotId} live preview`}
    />
  );
});
