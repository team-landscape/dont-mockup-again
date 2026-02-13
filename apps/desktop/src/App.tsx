import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowUp, FolderDown, FolderUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import {
  ColorField,
  FontSelector,
  InspectorCopyFields,
  LabeledField,
  LocaleSelector,
  NumberField,
  SwitchRow
} from './components/form/InspectorControls';
import { ExportWorkflowPage } from './workflows/ExportWorkflowPage';
import { LocalizationWorkflowPage } from './workflows/LocalizationWorkflowPage';
import { PreviewWorkflowPage } from './workflows/PreviewWorkflowPage';
import { ScreensWorkflowPage } from './workflows/ScreensWorkflowPage';
import { renderTemplatePreviewBase64, SlotCard, SlotRenderPreview } from './components/preview/SlotPreview';
import {
  browserFileToBase64,
  getDefaultExportDir,
  isTauriRuntime,
  listPngFiles,
  listSystemFonts,
  pickOutputDir,
  pickProjectFile,
  pickProjectSavePath,
  readFileBase64,
  readTextFile,
  runPipeline,
  writeFileBase64,
  writeTextFile
} from './lib/desktop-runtime';
import {
  type Align,
  type Device,
  type LlmCliConfig,
  type Platform,
  type Slot,
  type SlotCanvasPosition,
  type StoreShotDoc,
  type TemplateBackground,
  type TemplateElement,
  type TemplateElementKind,
  type TemplateImageElement,
  type TemplateMain,
  type TemplateTextElement,
  type TemplateTextSource,
  appendPathSegment,
  asNumber,
  buildProjectSnapshotForPersistence,
  clampTextWidthPercent,
  clampNumber,
  clone,
  cloneTemplateElements,
  createDefaultProject,
  defaultSlotCanvasPosition,
  defaultLlmConfig,
  defaultSystemFonts,
  detectDevicePlatform,
  detectPlatformFromDeviceId,
  devicePresets,
  fieldKey,
  getParentDirectory,
  getSlotCanvasCardSize,
  getSlotPreviewCanvasSize,
  globalTemplateImageKey,
  imageMimeTypeFromPath,
  localePresets,
  normalizeProject,
  normalizeTemplateElementOrder,
  PINCH_ZOOM_ACCELERATION,
  reorderSlots,
  resolveHorizontalAlignedX,
  resolveImageLayerForPreview,
  resolveNextSlotIdentity,
  resolveSlotCanvasPosition,
  resolveTemplateElementsForSlot,
  resolveTextWidthFromPercent,
  resolveTextLayerWithinSlot,
  serializeProjectSignature,
  SLOT_CANVAS_HEIGHT,
  SLOT_CANVAS_MAX_ZOOM,
  SLOT_CANVAS_MIN_ZOOM,
  SLOT_CANVAS_WIDTH,
  sortSlotsByOrder,
  slotTemplateImageKey,
  syncTemplateLegacyFields,
  TEMPLATE_REFERENCE_HEIGHT,
  TEMPLATE_REFERENCE_WIDTH
} from './lib/project-model';

type StepId = 'screens' | 'localization' | 'preview' | 'export';

interface ValidateIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

interface BusyRunOptions {
  action?: string;
  title?: string;
  detail?: string;
}

const steps: Array<{ id: StepId; title: string }> = [
  { id: 'screens', title: 'Screens' },
  { id: 'localization', title: 'Localization' },
  { id: 'preview', title: 'Preview / Validate' },
  { id: 'export', title: 'Export' }
];

const XL_MEDIA_QUERY = '(min-width: 1280px)';
const ONBOARDING_STORAGE_KEY = 'storeshot.desktop.onboarding.v1.completed';
const DEFAULT_PROJECT_FILE_NAME = 'project.storeshot.json';

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function App() {
  const [activeStep, setActiveStep] = useState<StepId>('screens');
  const [projectPath, setProjectPath] = useState('');
  const [savedProjectSignature, setSavedProjectSignature] = useState<string | null>(null);
  const [isProjectBaselineReady, setIsProjectBaselineReady] = useState(false);
  const [projectStatus, setProjectStatus] = useState('');
  const [projectError, setProjectError] = useState('');
  const [doc, setDoc] = useState<StoreShotDoc>(() => createDefaultProject());
  const [outputDir, setOutputDir] = useState('dist');
  const [defaultExportDir, setDefaultExportDir] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [busyTitle, setBusyTitle] = useState('');
  const [busyDetail, setBusyDetail] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('ios_phone');
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const [selectedSlot, setSelectedSlot] = useState('slot1');
  const [selectedSlotNameDraft, setSelectedSlotNameDraft] = useState('');
  const [selectedTemplateElementId, setSelectedTemplateElementId] = useState('text-title');
  const [screenFocusTrigger, setScreenFocusTrigger] = useState(0);
  const [slotPreviewUrls, setSlotPreviewUrls] = useState<Record<string, string>>({});
  const [slotPreviewPaths, setSlotPreviewPaths] = useState<Record<string, string>>({});
  const [previewMatrixUrls, setPreviewMatrixUrls] = useState<Record<string, Record<string, string>>>({});
  const [previewMatrixPaths, setPreviewMatrixPaths] = useState<Record<string, Record<string, string>>>({});
  const [slotSourceUrls, setSlotSourceUrls] = useState<Record<string, string>>({});
  const [templateImageUrls, setTemplateImageUrls] = useState<Record<string, string>>({});
  const [availableFonts, setAvailableFonts] = useState<string[]>(defaultSystemFonts);
  const [issues, setIssues] = useState<ValidateIssue[]>([]);
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1';
  });
  const [isXlLayout, setIsXlLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(XL_MEDIA_QUERY).matches;
  });
  const slotImageInputRef = useRef<HTMLInputElement>(null);
  const slotImageTargetRef = useRef<string | null>(null);
  const templateImageInputRef = useRef<HTMLInputElement>(null);
  const templateImageTargetRef = useRef<string | null>(null);
  const slotSourceEntriesRef = useRef<Array<{ id: string; sourceImagePath: string }>>([]);
  const [, startSlotTransition] = useTransition();
  const [, startTemplateTransition] = useTransition();

  const homeDir = useMemo(() => {
    const marker = '/Store Metadata Studio';
    if (!defaultExportDir || !defaultExportDir.endsWith(marker)) {
      return '';
    }
    return defaultExportDir.slice(0, -marker.length);
  }, [defaultExportDir]);

  const resolveOutputDir = useCallback((value: string | undefined) => {
    let normalized = typeof value === 'string' ? value.trim() : '';
    if (homeDir) {
      if (normalized === '~') {
        normalized = homeDir;
      } else if (normalized.startsWith('~/')) {
        normalized = `${homeDir}/${normalized.slice(2)}`;
      }

      const legacySuffix = '/유저/Store Metadata Studio';
      if (normalized.endsWith(legacySuffix)) {
        normalized = `${homeDir}/Store Metadata Studio`;
      }
    }
    if (!normalized || normalized === 'dist') {
      return defaultExportDir || 'dist';
    }
    return normalized;
  }, [defaultExportDir, homeDir]);

  const currentProjectSignature = useMemo(() => {
    const resolvedOutputDir = resolveOutputDir(outputDir);
    const snapshot = buildProjectSnapshotForPersistence(doc, resolvedOutputDir, {
      syncTemplateMain: true,
      slotWidth: TEMPLATE_REFERENCE_WIDTH
    });
    return serializeProjectSignature(snapshot);
  }, [doc, outputDir, resolveOutputDir]);

  const hasUnsavedChanges = useMemo(
    () => savedProjectSignature !== null && currentProjectSignature !== savedProjectSignature,
    [currentProjectSignature, savedProjectSignature]
  );

  const previewRenderDir = useMemo(() => 'dist-render', []);

  const activeStepIndex = useMemo(
    () => Math.max(steps.findIndex((item) => item.id === activeStep), 0),
    [activeStep]
  );
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;

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

  const expectedPreviewPath = useMemo(
    () => `${previewRenderDir}/${selectedPlatform}/${selectedDevice}/${selectedLocale}/${selectedSlot}.png`,
    [previewRenderDir, selectedPlatform, selectedDevice, selectedLocale, selectedSlot]
  );

  const llmConfig = doc.pipelines.localization.llmCli || clone(defaultLlmConfig);
  const deferredTemplateMain = useDeferredValue(doc.template.main);
  const templateElements = useMemo(
    () => normalizeTemplateElementOrder(resolveTemplateElementsForSlot(doc.template.main, selectedSlot)),
    [doc.template.main, selectedSlot]
  );
  const selectedTemplateElement = useMemo(
    () => templateElements.find((item) => item.id === selectedTemplateElementId) || templateElements[0] || null,
    [selectedTemplateElementId, templateElements]
  );
  const selectedElementFontOptions = useMemo(() => {
    if (!selectedTemplateElement || selectedTemplateElement.kind !== 'text') {
      return availableFonts;
    }

    const merged = new Set([...availableFonts, selectedTemplateElement.font]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [availableFonts, selectedTemplateElement]);
  const slotSourceLoadKey = useMemo(() => {
    const entries = doc.project.slots.map((slot) => ({ id: slot.id, sourceImagePath: slot.sourceImagePath }));
    slotSourceEntriesRef.current = entries;
    return entries.map((entry) => `${entry.id}:${entry.sourceImagePath}`).join('|');
  }, [doc.project.slots]);
  const templateImageLoadKey = useMemo(() => {
    const signatures: string[] = [];

    for (const item of doc.template.main.elements) {
      if (item.kind !== 'image') continue;
      signatures.push(`*:${item.id}:${item.imagePath}`);
    }

    for (const [slotId, elements] of Object.entries(doc.template.main.slotElements)) {
      for (const item of elements) {
        if (item.kind !== 'image') continue;
        signatures.push(`${slotId}:${item.id}:${item.imagePath}`);
      }
    }

    signatures.sort();
    return signatures.join('|');
  }, [doc.template.main.elements, doc.template.main.slotElements]);
  const previewMatrixLoadKey = useMemo(
    () => [
      previewRenderDir,
      selectedPlatform,
      selectedDevice,
      doc.project.locales.join(','),
      doc.project.slots.map((slot) => slot.id).join(',')
    ].join('|'),
    [doc.project.locales, doc.project.slots, previewRenderDir, selectedDevice, selectedPlatform]
  );

  useEffect(() => {
    if (activeStep !== 'screens') return;
    setScreenFocusTrigger((current) => current + 1);
  }, [activeStep]);

  const goPrevStep = useCallback(() => {
    if (activeStepIndex === 0) return;
    setActiveStep(steps[activeStepIndex - 1].id);
  }, [activeStepIndex]);

  const goNextStep = useCallback(() => {
    if (activeStepIndex >= steps.length - 1) return;
    setActiveStep(steps[activeStepIndex + 1].id);
  }, [activeStepIndex]);

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
    if (templateElements.length === 0) {
      setSelectedTemplateElementId('');
      return;
    }

    if (!templateElements.some((item) => item.id === selectedTemplateElementId)) {
      setSelectedTemplateElementId(templateElements[0].id);
    }
  }, [selectedTemplateElementId, templateElements]);

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
    let cancelled = false;

    async function loadTemplateImages() {
      if (!isTauriRuntime()) {
        if (!cancelled) setTemplateImageUrls({});
        return;
      }

      const next: Record<string, string> = {};
      const imageElements = doc.template.main.elements.filter((item): item is TemplateImageElement => item.kind === 'image');
      for (const element of imageElements) {
        if (!element.imagePath) continue;

        try {
          const base64 = await readFileBase64(element.imagePath);
          const mime = imageMimeTypeFromPath(element.imagePath);
          next[globalTemplateImageKey(element.id)] = `data:${mime};base64,${base64}`;
        } catch {
          // Missing custom image is allowed while editing.
        }
      }

      for (const [slotId, elements] of Object.entries(doc.template.main.slotElements)) {
        const slotImageElements = elements.filter((item): item is TemplateImageElement => item.kind === 'image');
        for (const element of slotImageElements) {
          if (!element.imagePath) continue;

          try {
            const base64 = await readFileBase64(element.imagePath);
            const mime = imageMimeTypeFromPath(element.imagePath);
            next[slotTemplateImageKey(slotId, element.id)] = `data:${mime};base64,${base64}`;
          } catch {
            // Missing custom image is allowed while editing.
          }
        }
      }

      if (!cancelled) {
        setTemplateImageUrls(next);
      }
    }

    void loadTemplateImages();
    return () => {
      cancelled = true;
    };
  }, [doc.template.main.elements, doc.template.main.slotElements, templateImageLoadKey]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setIsProjectBaselineReady(true);
      return;
    }

    getDefaultExportDir()
      .then((path) => {
        if (!path || !path.trim()) return;
        setDefaultExportDir(path);
        setOutputDir((current) => {
          const normalized = current.trim();
          if (!normalized || normalized === 'dist') {
            return path;
          }
          return current;
        });
        setProjectPath((current) => {
          if (current.trim()) return current;
          return appendPathSegment(path, DEFAULT_PROJECT_FILE_NAME);
        });
      })
      .catch(() => {
        setProjectPath((current) => (current.trim() ? current : DEFAULT_PROJECT_FILE_NAME));
        // Fallback to static default when system export path lookup fails.
      })
      .finally(() => {
        setIsProjectBaselineReady(true);
      });
  }, []);

  useEffect(() => {
    if (!isProjectBaselineReady || savedProjectSignature !== null) {
      return;
    }
    setSavedProjectSignature(currentProjectSignature);
  }, [currentProjectSignature, isProjectBaselineReady, savedProjectSignature]);

  function updateDoc(mutator: (next: StoreShotDoc) => void) {
    setDoc((current) => {
      const next = clone(current);
      mutator(next);
      return next;
    });
  }

  async function runWithBusy(
    action: (helpers: {
      setTitle: (value: string) => void;
      setDetail: (value: string) => void;
    }) => Promise<void>,
    options: BusyRunOptions = {}
  ) {
    const updateTitle = (value: string) => setBusyTitle(value);
    const updateDetail = (value: string) => setBusyDetail(value);

    flushSync(() => {
      setBusyAction(options.action || '');
      setBusyTitle(options.title || 'Processing');
      setBusyDetail(options.detail || 'Please wait...');
      setIsBusy(true);
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (typeof window !== 'undefined') {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    try {
      await action({ setTitle: updateTitle, setDetail: updateDetail });
    } finally {
      setIsBusy(false);
      setBusyAction('');
      setBusyTitle('');
      setBusyDetail('');
    }
  }

  async function handleLoadProject() {
    if (!isTauriRuntime()) {
      setProjectError('Load is available only in desktop runtime.');
      return;
    }

    try {
      const preferredDir = getParentDirectory(projectPath) || defaultExportDir || undefined;
      const pickedPath = await pickProjectFile(preferredDir);
      if (!pickedPath || !pickedPath.trim()) {
        setProjectStatus('Load cancelled.');
        setProjectError('');
        return;
      }

      await runWithBusy(async () => {
        const text = await readTextFile(pickedPath);
        const parsed = extractJson(text);
        const normalized = normalizeProject(parsed);
        const resolvedLoadedOutputDir = resolveOutputDir(normalized.pipelines.export.outputDir);
        const loadedSnapshot = buildProjectSnapshotForPersistence(normalized, resolvedLoadedOutputDir, {
          syncTemplateMain: true,
          slotWidth: TEMPLATE_REFERENCE_WIDTH
        });
        setDoc(normalized);
        setOutputDir(resolvedLoadedOutputDir);
        setProjectPath(pickedPath);
        setSavedProjectSignature(serializeProjectSignature(loadedSnapshot));
      }, {
        action: 'load-project',
        title: 'Loading Project',
        detail: 'Reading project file...'
      });
      setProjectError('');
      setProjectStatus(`Loaded ${pickedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
    }
  }

  async function handleSaveProject(options?: { cancelStatus?: string }): Promise<boolean> {
    if (!isTauriRuntime()) {
      setProjectError('Save is available only in desktop runtime.');
      return false;
    }

    try {
      let targetPath = projectPath.trim();
      const cancelStatus = options?.cancelStatus || 'Save cancelled.';
      if (!targetPath) {
        const preferredDir = defaultExportDir || undefined;
        const pickedPath = await pickProjectSavePath(DEFAULT_PROJECT_FILE_NAME, preferredDir);
        if (!pickedPath || !pickedPath.trim()) {
          setProjectStatus(cancelStatus);
          setProjectError('');
          return false;
        }
        targetPath = pickedPath;
      }

      await runWithBusy(async () => {
        const next = buildProjectSnapshotForPersistence(doc, resolveOutputDir(outputDir), {
          syncTemplateMain: true,
          slotWidth: TEMPLATE_REFERENCE_WIDTH
        });
        await writeTextFile(targetPath, JSON.stringify(next, null, 2));
        setProjectPath(targetPath);
        setSavedProjectSignature(serializeProjectSignature(next));
      }, {
        action: 'save-project',
        title: 'Saving Project',
        detail: 'Writing project changes...'
      });
      setProjectError('');
      setProjectStatus(`Saved ${targetPath}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
      return false;
    }
  }

  async function handleCreateNewProject() {
    if (hasUnsavedChanges) {
      const shouldSave = typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm('저장되지 않은 변경사항이 있습니다. New 전에 먼저 저장할까요?');

      if (!shouldSave) {
        setProjectStatus('New cancelled.');
        setProjectError('');
        return;
      }

      const saved = await handleSaveProject({ cancelStatus: 'New cancelled (save cancelled).' });
      if (!saved) {
        return;
      }
    }

    const fresh = createDefaultProject();
    const resolvedFreshOutputDir = resolveOutputDir(fresh.pipelines.export.outputDir);
    const freshSnapshot = buildProjectSnapshotForPersistence(fresh, resolvedFreshOutputDir, {
      syncTemplateMain: true,
      slotWidth: TEMPLATE_REFERENCE_WIDTH
    });
    setDoc(fresh);
    setOutputDir(resolvedFreshOutputDir);
    setIssues([]);
    setProjectPath('');
    setSavedProjectSignature(serializeProjectSignature(freshSnapshot));
    setProjectError('');
    setProjectStatus('Started a new project (unsaved). Use Save to choose a file.');
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
      const ordered = sortSlotsByOrder(next.project.slots);
      const index = ordered.findIndex((slot) => slot.id === slotId);
      if (index < 0) return;

      const target = index + direction;
      if (target < 0 || target >= ordered.length) return;

      const [picked] = ordered.splice(index, 1);
      ordered.splice(target, 0, picked);
      next.project.slots = reorderSlots(ordered);
    });
  }

  function openSlotImagePicker(slotId: string) {
    slotImageTargetRef.current = slotId;
    slotImageInputRef.current?.click();
  }

  function addSlot() {
    let createdSlotId = '';

    updateDoc((next) => {
      const orderedSlots = sortSlotsByOrder(next.project.slots);
      const referenceSlot = orderedSlots.find((slot) => slot.id === 'slot1') || orderedSlots[0];
      const { slotId: nextId, slotNumber: nextNumber } = resolveNextSlotIdentity(next.project.slots);

      const nextIndex = next.project.slots.length + 1;
      const newSlot = {
        id: nextId,
        name: `슬롯 ${nextNumber}`,
        order: nextIndex,
        sourceImagePath: ''
      };
      createdSlotId = newSlot.id;

      const referenceTitleKey = referenceSlot ? fieldKey(referenceSlot.id, 'title') : '';
      const referenceSubtitleKey = referenceSlot ? fieldKey(referenceSlot.id, 'subtitle') : '';
      const referenceTitleCopy = referenceTitleKey ? next.copy.keys[referenceTitleKey] || {} : {};
      const referenceSubtitleCopy = referenceSubtitleKey ? next.copy.keys[referenceSubtitleKey] || {} : {};
      const referenceBackground = referenceSlot
        ? (next.template.main.slotBackgrounds[referenceSlot.id] || next.template.main.background)
        : next.template.main.background;
      const referenceElements = referenceSlot
        ? resolveTemplateElementsForSlot(next.template.main, referenceSlot.id)
        : next.template.main.elements;

      next.project.slots.push(newSlot);
      next.copy.keys[fieldKey(newSlot.id, 'title')] = { ...referenceTitleCopy };
      next.copy.keys[fieldKey(newSlot.id, 'subtitle')] = { ...referenceSubtitleCopy };
      next.template.main.slotBackgrounds[newSlot.id] = {
        ...referenceBackground
      };
      next.template.main.slotElements[newSlot.id] = cloneTemplateElements(referenceElements);
    });

    if (createdSlotId) {
      startSlotTransition(() => {
        setSelectedSlot(createdSlotId);
      });
      openSlotImagePicker(createdSlotId);
    }
  }

  function removeSlot(slotId: string) {
    updateDoc((next) => {
      next.project.slots = reorderSlots(next.project.slots.filter((slot) => slot.id !== slotId));
      delete next.copy.keys[fieldKey(slotId, 'title')];
      delete next.copy.keys[fieldKey(slotId, 'subtitle')];
      delete next.template.main.slotBackgrounds[slotId];
      delete next.template.main.slotElements[slotId];
    });
  }

  const renameSlot = useCallback((slotId: string, nextName: string) => {
    const normalizedName = nextName.trim();
    if (!normalizedName) return;

    setDoc((current) => {
      let changed = false;
      const nextSlots = current.project.slots.map((slot) => {
        if (slot.id !== slotId) return slot;
        if (slot.name === normalizedName) return slot;
        changed = true;
        return { ...slot, name: normalizedName };
      });

      if (!changed) return current;
      return {
        ...current,
        project: {
          ...current.project,
          slots: nextSlots
        }
      };
    });
  }, []);

  const persistProjectSnapshot = useCallback(async (options?: { syncTemplateMain?: boolean }) => {
    if (!projectPath.trim()) {
      throw new Error('No project file selected. Save project first.');
    }

    const next = buildProjectSnapshotForPersistence(doc, resolveOutputDir(outputDir), {
      syncTemplateMain: options?.syncTemplateMain !== false,
      slotWidth: Math.max(1, selectedDeviceSpec.width || TEMPLATE_REFERENCE_WIDTH)
    });
    await writeTextFile(projectPath, JSON.stringify(next, null, 2));
    setSavedProjectSignature(serializeProjectSignature(next));
    return next;
  }, [doc, outputDir, projectPath, resolveOutputDir, selectedDeviceSpec.width]);

  async function handleRunLocalization() {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();

      setDetail('Running localization pipeline...');
      await runPipeline('localize', [projectPath, '--write']);

      setDetail('Reloading localized copy...');
      const text = await readTextFile(projectPath);
      const parsed = extractJson(text);
      const normalized = normalizeProject(parsed);
      setDoc(normalized);
    }, {
      action: 'localize',
      title: 'Localization Processing',
      detail: 'Preparing localization run...'
    });
  }

  async function loadSlotPreviewMap() {
    const sortedSlots = sortSlotsByOrder(doc.project.slots);
    const files = await listPngFiles(previewRenderDir);
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

  async function loadPreviewMatrix() {
    const sortedSlots = sortSlotsByOrder(doc.project.slots);
    const locales = [...doc.project.locales];
    let files: string[] = [];
    try {
      files = await listPngFiles(previewRenderDir);
    } catch {
      setPreviewMatrixUrls({});
      setPreviewMatrixPaths({});
      return {};
    }

    const urlsByLocale: Record<string, Record<string, string>> = {};
    const pathsByLocale: Record<string, Record<string, string>> = {};

    for (const locale of locales) {
      urlsByLocale[locale] = {};
      pathsByLocale[locale] = {};

      for (const slot of sortedSlots) {
        const suffix = `${selectedPlatform}/${selectedDevice}/${locale}/${slot.id}.png`;
        const picked = files.find((entry) => entry.endsWith(suffix));
        if (!picked) continue;

        const base64 = await readFileBase64(picked);
        urlsByLocale[locale][slot.id] = `data:image/png;base64,${base64}`;
        pathsByLocale[locale][slot.id] = picked;
      }
    }

    setPreviewMatrixUrls(urlsByLocale);
    setPreviewMatrixPaths(pathsByLocale);
    return urlsByLocale;
  }

  const renderExportImagesFromPreview = useCallback(async (
    snapshot: StoreShotDoc,
    targetDir: string,
    onProgress?: (detail: string) => void
  ) => {
    const slots = sortSlotsByOrder(snapshot.project.slots || []);
    const locales = snapshot.project.locales || [];
    const platforms = snapshot.project.platforms || [];
    const devices = snapshot.project.devices || [];
    const templateMain = snapshot.template.main;
    const imageUrls = { ...templateImageUrls };

    const imageTargets: Array<{ key: string; path: string }> = [];
    for (const element of templateMain.elements) {
      if (element.kind !== 'image' || !element.imagePath) continue;
      imageTargets.push({ key: globalTemplateImageKey(element.id), path: element.imagePath });
    }
    for (const [slotId, elements] of Object.entries(templateMain.slotElements || {})) {
      for (const element of elements) {
        if (element.kind !== 'image' || !element.imagePath) continue;
        imageTargets.push({ key: slotTemplateImageKey(slotId, element.id), path: element.imagePath });
      }
    }

    for (const target of imageTargets) {
      if (imageUrls[target.key]) continue;
      try {
        const base64 = await readFileBase64(target.path);
        const mime = imageMimeTypeFromPath(target.path);
        imageUrls[target.key] = `data:${mime};base64,${base64}`;
      } catch {
        // Missing image path is allowed; renderer keeps placeholder.
      }
    }

    const total = Math.max(1, devices.length * locales.length * slots.length);
    let current = 0;

    for (const device of devices) {
      const platform = detectDevicePlatform(device, platforms);
      if (platforms.length > 0 && !platforms.includes(platform)) continue;

      for (const locale of locales) {
        for (const slot of slots) {
          current += 1;
          onProgress?.(`Rendering preview images... (${current}/${total})`);

          const title = snapshot.copy.keys[fieldKey(slot.id, 'title')]?.[locale] || '';
          const subtitle = snapshot.copy.keys[fieldKey(slot.id, 'subtitle')]?.[locale] || '';
          const template: TemplateMain = {
            ...templateMain,
            elements: resolveTemplateElementsForSlot(templateMain, slot.id),
            background: {
              ...templateMain.background,
              ...(templateMain.slotBackgrounds[slot.id] || {})
            }
          };
          const pngBase64 = await withTimeout(
            renderTemplatePreviewBase64({
              slotId: slot.id,
              title,
              subtitle,
              template,
              templateImageUrls: imageUrls,
              device
            }),
            20000,
            `preview render ${platform}/${device.id}/${locale}/${slot.id}`
          );

          const outPath = `${targetDir}/${platform}/${device.id}/${locale}/${slot.id}.png`;
          await writeFileBase64(outPath, pngBase64);
        }
      }
    }
  }, [templateImageUrls]);

  const collectExpectedRenderSuffixes = useCallback((snapshot: StoreShotDoc) => {
    const suffixes: string[] = [];
    const slots = sortSlotsByOrder(snapshot.project.slots || []);
    const locales = snapshot.project.locales || [];
    const platforms = snapshot.project.platforms || [];
    const devices = snapshot.project.devices || [];

    for (const device of devices) {
      const platform = detectDevicePlatform(device, platforms);
      if (platforms.length > 0 && !platforms.includes(platform)) continue;
      for (const locale of locales) {
        for (const slot of slots) {
          suffixes.push(`${platform}/${device.id}/${locale}/${slot.id}.png`);
        }
      }
    }

    return suffixes;
  }, []);

  const findMissingRenderedFiles = useCallback(async (baseDir: string, expectedSuffixes: string[]) => {
    const files = await listPngFiles(baseDir);
    const missing = expectedSuffixes.filter((suffix) => !files.some((entry) => entry.endsWith(suffix)));
    return { files, missing };
  }, []);

  async function handleRender() {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();
      setDetail('Rendering preview images...');
      await runPipeline('render', [projectPath, previewRenderDir]);
      await loadSlotPreviewMap();
      await loadPreviewMatrix();
    }, {
      action: 'render',
      title: 'Rendering',
      detail: 'Generating preview images...'
    });
  }

  async function handleValidate() {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();
      setDetail('Checking project rules...');
      const output = await runPipeline('validate', [projectPath]);
      const parsed = extractJson(output) as { issues?: ValidateIssue[] } | null;
      setIssues(parsed?.issues || []);
    }, {
      action: 'validate',
      title: 'Validation',
      detail: 'Checking project rules...'
    });
  }

  async function handleExport() {
    setExportStatus('');
    setExportError('');

    if (!isTauriRuntime()) {
      setExportError('Export is available only in desktop runtime. Start with `npm --prefix apps/desktop run tauri:dev`.');
      return;
    }

    try {
      await runWithBusy(async ({ setDetail }) => {
        const flags: string[] = [];
        if (doc.pipelines.export.zip) flags.push('--zip');
        if (doc.pipelines.export.metadataCsv) flags.push('--metadata-csv');
        const resolvedOutputDir = resolveOutputDir(outputDir);
        if (resolvedOutputDir !== outputDir) {
          setOutputDir(resolvedOutputDir);
        }

        setDetail('Saving project config...');
        const snapshot = await persistProjectSnapshot({ syncTemplateMain: false });
        const expectedSuffixes = collectExpectedRenderSuffixes(snapshot);
        if (expectedSuffixes.length === 0) {
          throw new Error('No export targets found. Check slots/locales/devices/platforms.');
        }

        await renderExportImagesFromPreview(snapshot, previewRenderDir, setDetail);
        setDetail('Verifying preview renders...');
        const previewCheck = await findMissingRenderedFiles(previewRenderDir, expectedSuffixes);
        if (previewCheck.missing.length > 0) {
          throw new Error(`Preview render missing ${previewCheck.missing.length} file(s). Example: ${previewCheck.missing[0]}`);
        }

        setDetail('Exporting preview renders...');
        const exportRaw = await runPipeline('export', [projectPath, previewRenderDir, resolvedOutputDir, ...flags]);
        const exportParsed = extractJson(exportRaw) as {
          outputDir?: string;
          zipPath?: string | null;
          metadataCsvPath?: string | null;
        } | null;
        const outputPath = exportParsed?.outputDir || resolvedOutputDir;

        setDetail('Verifying exported files...');
        const exportCheck = await findMissingRenderedFiles(outputPath, expectedSuffixes);
        if (exportCheck.missing.length > 0) {
          throw new Error(`Export output missing ${exportCheck.missing.length} file(s). Example: ${exportCheck.missing[0]}`);
        }

        const extras = [
          exportParsed?.zipPath ? `zip: ${exportParsed.zipPath}` : '',
          exportParsed?.metadataCsvPath ? `csv: ${exportParsed.metadataCsvPath}` : ''
        ].filter(Boolean).join(' | ');
        setExportStatus(extras ? `Exported to ${outputPath} (${extras})` : `Exported to ${outputPath}`);
      }, {
        action: 'export',
        title: 'Exporting',
        detail: 'Preparing export...'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message);
    }
  }

  const handlePickOutputDir = useCallback(async () => {
    if (!isTauriRuntime()) {
      return;
    }

    try {
      const picked = await pickOutputDir();
      if (picked && picked.trim()) {
        setOutputDir(picked);
      }
    } catch {
      // Keep output path editing resilient if folder picker fails.
    }
  }, []);

  async function handleRefreshPreview() {
    await runWithBusy(async () => {
      await loadSlotPreviewMap();
      await loadPreviewMatrix();
    }, {
      action: 'refresh-preview',
      title: 'Refreshing Preview',
      detail: 'Loading latest rendered images...'
    });
  }

  function handleOpenOnboarding() {
    setIsOnboardingOpen(true);
  }

  function handleCompleteOnboarding() {
    if (!onboardingReady) {
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
  }

  function upsertLlmConfig(mutator: (cfg: LlmCliConfig) => void) {
    updateDoc((next) => {
      next.pipelines.localization.llmCli = next.pipelines.localization.llmCli || clone(defaultLlmConfig);
      mutator(next.pipelines.localization.llmCli);
    });
  }

  const slots = useMemo(
    () => sortSlotsByOrder(doc.project.slots),
    [doc.project.slots]
  );
  const selectedSlotData = useMemo(
    () => slots.find((slot) => slot.id === selectedSlot) || null,
    [slots, selectedSlot]
  );
  useEffect(() => {
    setSelectedSlotNameDraft(selectedSlotData?.name || '');
  }, [selectedSlotData?.id, selectedSlotData?.name]);
  const commitSelectedSlotName = useCallback(() => {
    if (!selectedSlotData) return;

    const normalizedName = selectedSlotNameDraft.trim();
    if (!normalizedName) {
      setSelectedSlotNameDraft(selectedSlotData.name);
      return;
    }

    renameSlot(selectedSlotData.id, normalizedName);
    setSelectedSlotNameDraft(normalizedName);
  }, [renameSlot, selectedSlotData, selectedSlotNameDraft]);
  const selectedTitleKey = useMemo(
    () => (selectedSlotData ? fieldKey(selectedSlotData.id, 'title') : ''),
    [selectedSlotData]
  );
  const selectedSubtitleKey = useMemo(
    () => (selectedSlotData ? fieldKey(selectedSlotData.id, 'subtitle') : ''),
    [selectedSlotData]
  );
  const selectedSlotBackground = useMemo<TemplateBackground>(() => {
    if (!selectedSlotData) return doc.template.main.background;
    return {
      ...doc.template.main.background,
      ...(doc.template.main.slotBackgrounds[selectedSlotData.id] || {})
    };
  }, [doc.template.main.background, doc.template.main.slotBackgrounds, selectedSlotData]);
  const previewPath = previewMatrixPaths[selectedLocale]?.[selectedSlot] || slotPreviewPaths[selectedSlot] || '';
  const onboardingReady = doc.project.locales.length > 0
    && doc.project.platforms.length > 0
    && doc.project.devices.length > 0;
  const slotCanvasCardSize = useMemo(
    () => getSlotCanvasCardSize(selectedDeviceSpec),
    [selectedDeviceSpec]
  );

  const slotCanvasPositions = useMemo<Record<string, SlotCanvasPosition>>(() => {
    const next: Record<string, SlotCanvasPosition> = {};
    slots.forEach((slot, index) => {
      next[slot.id] = defaultSlotCanvasPosition(index, slotCanvasCardSize.width);
    });
    return next;
  }, [slotCanvasCardSize.height, slotCanvasCardSize.width, slots]);

  const reorderSlotByDrag = useCallback((slotId: string, targetIndex: number) => {
    updateDoc((next) => {
      const ordered = sortSlotsByOrder(next.project.slots);
      const fromIndex = ordered.findIndex((slot) => slot.id === slotId);
      if (fromIndex < 0) return;

      const clampedTargetIndex = Math.max(0, Math.min(ordered.length - 1, targetIndex));
      if (clampedTargetIndex === fromIndex) return;

      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(clampedTargetIndex, 0, moved);
      next.project.slots = reorderSlots(ordered);
    });
  }, []);

  const screenCanvasSlots = useMemo<CanvasSlotItem[]>(() => (
    slots.map((slot) => ({
      slot,
      titleValue: doc.copy.keys[fieldKey(slot.id, 'title')]?.[selectedLocale] || '',
      subtitleValue: doc.copy.keys[fieldKey(slot.id, 'subtitle')]?.[selectedLocale] || '',
      renderedPreviewUrl: slotPreviewUrls[slot.id],
      sourceImageUrl: slotSourceUrls[slot.id],
      template: {
        ...deferredTemplateMain,
        elements: resolveTemplateElementsForSlot(deferredTemplateMain, slot.id),
        background: {
          ...deferredTemplateMain.background,
          ...(deferredTemplateMain.slotBackgrounds[slot.id] || {})
        }
      }
    }))
  ), [
    doc.copy.keys,
    deferredTemplateMain,
    selectedLocale,
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

  const handleSelectSlot = useCallback((slotId: string) => {
    startSlotTransition(() => {
      setSelectedSlot(slotId);
    });
  }, [startSlotTransition]);

  const renderPreviewSlotCard = useCallback((params: {
    locale: string;
    slotId: string;
    slotLabel: string;
  }) => {
    const { locale, slotId, slotLabel } = params;
    const titleValue = doc.copy.keys[fieldKey(slotId, 'title')]?.[locale] || '';
    const subtitleValue = doc.copy.keys[fieldKey(slotId, 'subtitle')]?.[locale] || '';
    const renderedPreviewUrl = previewMatrixUrls[locale]?.[slotId] || slotPreviewUrls[slotId];
    const sourceImageUrl = slotSourceUrls[slotId];
    const template = {
      ...deferredTemplateMain,
      elements: resolveTemplateElementsForSlot(deferredTemplateMain, slotId),
      background: {
        ...deferredTemplateMain.background,
        ...(deferredTemplateMain.slotBackgrounds[slotId] || {})
      }
    };
    const isCurrentSelection = selectedLocale === locale && selectedSlot === slotId;

    return (
      <button
        type="button"
        className="w-full text-left"
        onClick={() => {
          setSelectedLocale(locale);
          handleSelectSlot(slotId);
        }}
      >
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{slotLabel}</p>
        <div className={isCurrentSelection ? 'rounded-md ring-2 ring-primary/35' : 'rounded-md'}>
          <SlotRenderPreview
            slotId={slotId}
            title={titleValue}
            subtitle={subtitleValue}
            renderedPreviewUrl={renderedPreviewUrl}
            sourceImageUrl={sourceImageUrl}
            template={template}
            templateImageUrls={templateImageUrls}
            device={selectedDeviceSpec}
            scaleImageToDevice
          />
        </div>
      </button>
    );
  }, [
    deferredTemplateMain,
    doc.copy.keys,
    handleSelectSlot,
    previewMatrixUrls,
    selectedDeviceSpec,
    selectedLocale,
    selectedSlot,
    slotPreviewUrls,
    slotSourceUrls,
    templateImageUrls
  ]);

  useEffect(() => {
    if (activeStep !== 'preview' || !isTauriRuntime()) {
      return;
    }

    void loadPreviewMatrix();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, previewMatrixLoadKey]);

  const updateTemplateMain = useCallback((mutator: (main: TemplateMain) => void) => {
    const slotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
    startTemplateTransition(() => {
      setDoc((current) => {
        const nextMain = clone(current.template.main);
        mutator(nextMain);

        return {
          ...current,
          template: {
            ...current.template,
            main: syncTemplateLegacyFields(nextMain, slotWidth)
          }
        };
      });
    });
  }, [selectedDeviceSpec.width, startTemplateTransition]);

  const updateTemplateBackground = useCallback((patch: Partial<TemplateMain['background']>) => {
    updateTemplateMain((main) => {
      const slotId = selectedSlotData?.id || selectedSlot;
      const current = main.slotBackgrounds[slotId] || main.background;
      main.slotBackgrounds[slotId] = {
        ...current,
        ...patch
      };
    });
  }, [selectedSlot, selectedSlotData, updateTemplateMain]);

  const updateTemplateElement = useCallback((elementId: string, mutator: (element: TemplateElement) => TemplateElement) => {
    updateTemplateMain((main) => {
      const slotId = selectedSlotData?.id || selectedSlot;
      const sourceElements = resolveTemplateElementsForSlot(main, slotId);
      const index = sourceElements.findIndex((item) => item.id === elementId);
      if (index < 0) return;
      const nextElements = cloneTemplateElements(sourceElements);
      nextElements[index] = mutator(nextElements[index]);
      main.slotElements[slotId] = normalizeTemplateElementOrder(nextElements);
    });
  }, [selectedSlot, selectedSlotData, updateTemplateMain]);

  const moveTemplateElement = useCallback((elementId: string, x: number, y: number) => {
    const slotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
    updateTemplateElement(elementId, (current) => {
      const nextXRaw = Math.round(x);
      const nextY = Math.round(y);
      const nextX = current.kind === 'text'
        ? clampNumber(nextXRaw, 0, Math.max(0, slotWidth - resolveTextWidthFromPercent(current.widthPercent, slotWidth)))
        : nextXRaw;
      if (current.x === nextX && current.y === nextY) {
        return current;
      }

      return {
        ...current,
        x: nextX,
        y: nextY
      };
    });
  }, [selectedDeviceSpec.width, updateTemplateElement]);

  const addTemplateElement = useCallback((kind: TemplateElementKind) => {
    let createdId = '';

    updateTemplateMain((main) => {
      const slotId = selectedSlotData?.id || selectedSlot;
      const sourceElements = resolveTemplateElementsForSlot(main, slotId);
      const slotElements = cloneTemplateElements(sourceElements);
      const existingIds = new Set(slotElements.map((item) => item.id));
      let nextNumber = 1;
      while (existingIds.has(`${kind}-${nextNumber}`)) {
        nextNumber += 1;
      }
      createdId = `${kind}-${nextNumber}`;

      const topZ = slotElements.reduce((max, item) => Math.max(max, item.z), 0);
      if (kind === 'text') {
        const slotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
        const newTextElement: TemplateTextElement = {
          id: createdId,
          name: `Text ${nextNumber}`,
          kind: 'text',
          x: 0,
          y: 120,
          w: slotWidth,
          h: 200,
          z: topZ + 10,
          visible: true,
          opacity: 100,
          rotation: 0,
          textSource: 'custom',
          customText: 'New text',
          font: availableFonts[0] || 'SF Pro',
          size: 64,
          lineHeight: 1.2,
          weight: 700,
          align: 'center',
          autoSize: true,
          widthPercent: 100,
          color: '#f9fafb',
          backgroundColor: 'transparent',
          padding: 0,
          cornerRadius: 0
        };
        slotElements.push(newTextElement);
        main.slotElements[slotId] = normalizeTemplateElementOrder(slotElements);
        return;
      }

      const newImageElement: TemplateImageElement = {
        id: createdId,
        name: `Image ${nextNumber}`,
        kind: 'image',
        x: 120,
        y: 560,
        w: 1000,
        h: 2000,
        z: topZ + 10,
        visible: true,
        opacity: 100,
        rotation: 0,
        source: 'image',
        imagePath: '',
        fillColor: '#111827',
        fit: 'cover',
        cornerRadius: 48,
        deviceFrame: false,
        frameInset: 0,
        frameRadius: 72,
        frameColor: '#ffffff',
        frameWidth: 3
      };
      slotElements.push(newImageElement);
      main.slotElements[slotId] = normalizeTemplateElementOrder(slotElements);
    });

    if (createdId) {
      setSelectedTemplateElementId(createdId);
    }
  }, [availableFonts, selectedDeviceSpec.width, selectedSlot, selectedSlotData, updateTemplateMain]);

  const removeTemplateElement = useCallback((elementId: string) => {
    updateTemplateMain((main) => {
      const slotId = selectedSlotData?.id || selectedSlot;
      const sourceElements = resolveTemplateElementsForSlot(main, slotId);
      if (sourceElements.length <= 1) return;

      const nextElements = sourceElements.filter((item) => item.id !== elementId);
      if (nextElements.length === sourceElements.length || nextElements.length === 0) return;

      main.slotElements[slotId] = normalizeTemplateElementOrder(cloneTemplateElements(nextElements));
    });
  }, [selectedSlot, selectedSlotData, updateTemplateMain]);

  const openTemplateImagePicker = useCallback((elementId: string) => {
    templateImageTargetRef.current = elementId;
    templateImageInputRef.current?.click();
  }, []);

  async function handleSlotImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const slotId = slotImageTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!slotId || !file) {
      slotImageTargetRef.current = null;
      return;
    }

    const extension = file.name.includes('.')
      ? (file.name.split('.').pop() || 'png').toLowerCase()
      : 'png';
    const normalizedExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
    const outputPath = `examples/assets/source/uploads/${slotId}-${Date.now()}.${normalizedExtension}`;

    try {
      await runWithBusy(async () => {
        const base64 = await browserFileToBase64(file);
        const mime = imageMimeTypeFromPath(file.name);
        const canWriteToDisk = isTauriRuntime();
        if (canWriteToDisk) {
          await writeFileBase64(outputPath, base64);
        }

        const sourcePath = canWriteToDisk ? outputPath : file.name;
        updateDoc((next) => {
          const target = next.project.slots.find((slot) => slot.id === slotId);
          if (!target) return;
          target.sourceImagePath = sourcePath;
        });

        setSlotSourceUrls((current) => ({
          ...current,
          [slotId]: `data:${mime};base64,${base64}`
        }));
      }, {
        action: 'upload-slot-image',
        title: 'Uploading Slot Image',
        detail: 'Saving selected slot image...'
      });
    } catch {
      // Keep file picker UX resilient if writing image fails.
    } finally {
      slotImageTargetRef.current = null;
    }
  }

  async function handleTemplateImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const elementId = templateImageTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!elementId || !file) {
      templateImageTargetRef.current = null;
      return;
    }

    const extension = file.name.includes('.')
      ? (file.name.split('.').pop() || 'png').toLowerCase()
      : 'png';
    const normalizedExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
    const outputPath = `examples/assets/source/uploads/${elementId}-${Date.now()}.${normalizedExtension}`;

    try {
      await runWithBusy(async () => {
        const base64 = await browserFileToBase64(file);
        const mime = imageMimeTypeFromPath(file.name);
        await writeFileBase64(outputPath, base64);

        updateTemplateElement(elementId, (current) => (
          current.kind === 'image'
            ? {
              ...current,
              source: 'image',
              imagePath: outputPath
            }
            : current
        ));

        setTemplateImageUrls((current) => ({
          ...current,
          [slotTemplateImageKey(selectedSlotData?.id || selectedSlot, elementId)]: `data:${mime};base64,${base64}`
        }));
      }, {
        action: 'upload-template-image',
        title: 'Uploading Image',
        detail: 'Saving template image asset...'
      });
    } catch {
      // Keep file picker UX resilient if writing image fails.
    } finally {
      templateImageTargetRef.current = null;
    }
  }

  const templateInspectorSection = useMemo(() => {
    let selectedElementInspector: React.ReactNode = null;

    if (selectedTemplateElement?.kind === 'text') {
      const textElement = selectedTemplateElement;
      selectedElementInspector = (
        <>
          <LabeledField label="Text Source">
            <Select
              value={textElement.textSource}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, textSource: value as TemplateTextSource } : current
              ))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="title">slot title</SelectItem>
                <SelectItem value="subtitle">slot subtitle</SelectItem>
                <SelectItem value="custom">custom text</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>

          {textElement.textSource === 'custom' ? (
            <LabeledField label="Custom Text">
              <Textarea
                value={textElement.customText}
                onChange={(event) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' ? { ...current, customText: event.target.value } : current
                ))}
                className="min-h-[96px]"
              />
            </LabeledField>
          ) : null}

          <SwitchRow
            label="Auto Size (Text Wrap)"
            checked={textElement.autoSize}
            onCheckedChange={(checked) => updateTemplateElement(textElement.id, (current) => (
              current.kind === 'text' ? { ...current, autoSize: checked } : current
            ))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Font">
              <FontSelector
                value={textElement.font}
                options={selectedElementFontOptions}
                onChange={(value) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' && current.font !== value ? { ...current, font: value } : current
                ))}
              />
            </LabeledField>
            <NumberField
              label="Size"
              value={textElement.size}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, size: value } : current
              ))}
            />
            <NumberField
              label="Line Height"
              value={textElement.lineHeight}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, lineHeight: Math.max(0.5, value || 1) } : current
              ))}
            />
            <NumberField
              label="Weight"
              value={textElement.weight}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, weight: value } : current
              ))}
            />
            <LabeledField label="Align">
              <Select
                value={textElement.align}
                onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' ? { ...current, align: value as Align } : current
                ))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">left</SelectItem>
                  <SelectItem value="center">center</SelectItem>
                  <SelectItem value="right">right</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>
            <ColorField
              label="Text Color"
              value={textElement.color}
              fallbackColor="#f9fafb"
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, color: value } : current
              ))}
            />
            <ColorField
              label="Background Color"
              value={textElement.backgroundColor}
              fallbackColor="#111827"
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, backgroundColor: value } : current
              ))}
            />
            <NumberField
              label="Padding"
              value={textElement.padding}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, padding: value } : current
              ))}
            />
            <NumberField
              label="Corner Radius"
              value={textElement.cornerRadius}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, cornerRadius: value } : current
              ))}
            />
          </div>
        </>
      );
    } else if (selectedTemplateElement?.kind === 'image') {
      const imageElement = selectedTemplateElement;
      selectedElementInspector = (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Mode">
              <div className="space-y-2">
                <Select
                  value={imageElement.source}
                  onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                    current.kind === 'image'
                      ? {
                        ...current,
                        source: value as 'image' | 'color'
                      }
                      : current
                  ))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="color">Color fill</SelectItem>
                  </SelectContent>
                </Select>

                {imageElement.source === 'image' ? (
                  <>
                    <p className="rounded-md border bg-muted/60 p-2 text-xs">
                      {imageElement.imagePath ? 'Image selected' : 'No image selected'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTemplateImagePicker(imageElement.id)}
                    >
                      Choose Image
                    </Button>
                  </>
                ) : (
                  <ColorField
                    label="Fill Color"
                    value={imageElement.fillColor}
                    fallbackColor="#111827"
                    onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                      current.kind === 'image' ? { ...current, fillColor: value } : current
                    ))}
                  />
                )}
              </div>
            </LabeledField>
            {imageElement.source === 'image' ? (
              <LabeledField label="Fit">
                <Select
                  value={imageElement.fit}
                  onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                    current.kind === 'image' ? { ...current, fit: value as 'cover' | 'contain' } : current
                  ))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">cover</SelectItem>
                    <SelectItem value="contain">contain</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledField>
            ) : null}
            <NumberField
              label="Corner Radius"
              value={imageElement.cornerRadius}
              onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                current.kind === 'image' ? { ...current, cornerRadius: value } : current
              ))}
            />
          </div>

          <SwitchRow
            label="Device Frame (Image only)"
            checked={imageElement.deviceFrame}
            onCheckedChange={(checked) => updateTemplateElement(imageElement.id, (current) => (
              current.kind === 'image' ? { ...current, deviceFrame: checked } : current
            ))}
          />

          {imageElement.deviceFrame ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Frame Inset"
                value={imageElement.frameInset}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameInset: value } : current
                ))}
              />
              <NumberField
                label="Frame Radius"
                value={imageElement.frameRadius}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameRadius: value } : current
                ))}
              />
              <NumberField
                label="Frame Width"
                value={imageElement.frameWidth}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameWidth: value } : current
                ))}
              />
              <ColorField
                label="Frame Color"
                value={imageElement.frameColor}
                fallbackColor="#ffffff"
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameColor: value } : current
                ))}
              />
            </div>
          ) : null}
        </>
      );
    }

    const inspectorSlotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
    const leftAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('left', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const centerAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('center', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const rightAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('right', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const horizontalAlignedState: Align | null = selectedTemplateElement
      ? Math.abs(selectedTemplateElement.x - leftAlignedX) <= 1
        ? 'left'
        : Math.abs(selectedTemplateElement.x - centerAlignedX) <= 1
          ? 'center'
          : Math.abs(selectedTemplateElement.x - rightAlignedX) <= 1
            ? 'right'
            : null
      : null;

    return (
      <>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Background</CardTitle>
            <CardDescription>
              {selectedSlotData ? `${selectedSlotData.id} 배경 설정` : '슬롯별 배경 설정'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Background Type">
              <Select
                value={selectedSlotBackground.type}
                onValueChange={(value) => updateTemplateBackground({ type: value as 'solid' | 'gradient' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">solid</SelectItem>
                  <SelectItem value="gradient">gradient</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            {selectedSlotBackground.type === 'solid' ? (
              <ColorField
                label="Color"
                value={selectedSlotBackground.value || '#111827'}
                fallbackColor="#111827"
                onValueChange={(value) => updateTemplateBackground({ value })}
              />
            ) : (
              <>
                <ColorField
                  label="From"
                  value={selectedSlotBackground.from || '#111827'}
                  fallbackColor="#111827"
                  onValueChange={(value) => updateTemplateBackground({ from: value })}
                />
                <ColorField
                  label="To"
                  value={selectedSlotBackground.to || '#1f2937'}
                  fallbackColor="#1f2937"
                  onValueChange={(value) => updateTemplateBackground({ to: value })}
                />
                <LabeledField label="Direction">
                  <Input value={selectedSlotBackground.direction || '180deg'} onChange={(event) => updateTemplateBackground({ direction: event.target.value })} />
                </LabeledField>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Layers</CardTitle>
            <CardDescription>선택한 슬롯에만 적용되는 텍스트/이미지 요소를 편집합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addTemplateElement('text')}>
                <Plus className="mr-1 h-4 w-4" />Add Text
              </Button>
              <Button size="sm" variant="outline" onClick={() => addTemplateElement('image')}>
                <Plus className="mr-1 h-4 w-4" />Add Image
              </Button>
            </div>

            <div className="space-y-2">
              {templateElements.map((element) => (
                <div key={element.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-left text-sm ${selectedTemplateElement?.id === element.id ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    onClick={() => setSelectedTemplateElementId(element.id)}
                  >
                    <span className="font-medium">{element.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{element.kind}</span>
                  </button>
                  <Button size="sm" variant="destructive" disabled={templateElements.length <= 1} onClick={() => removeTemplateElement(element.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedTemplateElement ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Element Inspector</CardTitle>
              <CardDescription>{selectedTemplateElement.name} · {selectedTemplateElement.kind}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LabeledField label="Element Name">
                <Input
                  value={selectedTemplateElement.name}
                  onChange={(event) => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                    ...current,
                    name: event.target.value
                  }))}
                />
              </LabeledField>

              <LabeledField label="Horizontal Align">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'left' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('left', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Left
                  </Button>
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'center' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('center', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Center
                  </Button>
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'right' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('right', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Right
                  </Button>
                </div>
              </LabeledField>

              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="X"
                  value={selectedTemplateElement.x}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => {
                    if (current.kind === 'text') {
                      const slotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
                      const textWidth = resolveTextWidthFromPercent(current.widthPercent, slotWidth);
                      return {
                        ...current,
                        x: clampNumber(value, 0, Math.max(0, slotWidth - textWidth))
                      };
                    }
                    return { ...current, x: value };
                  })}
                />
                <NumberField
                  label="Y"
                  value={selectedTemplateElement.y}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, y: value }))}
                />
                <NumberField
                  label={selectedTemplateElement.kind === 'text' ? 'Width (%)' : 'Width'}
                  value={selectedTemplateElement.kind === 'text' ? selectedTemplateElement.widthPercent : selectedTemplateElement.w}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => {
                    if (current.kind === 'text') {
                      const slotWidth = Math.max(1, selectedDeviceSpec.width || 1290);
                      const widthPercent = clampTextWidthPercent(value);
                      const textWidth = resolveTextWidthFromPercent(widthPercent, slotWidth);
                      const centeredX = Math.round((slotWidth - textWidth) / 2);
                      return {
                        ...current,
                        widthPercent,
                        w: textWidth,
                        x: clampNumber(centeredX, 0, Math.max(0, slotWidth - textWidth))
                      };
                    }
                    return { ...current, w: value };
                  })}
                />
                <NumberField
                  label="Height"
                  value={selectedTemplateElement.h}
                  disabled={selectedTemplateElement.kind === 'text' && selectedTemplateElement.autoSize}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, h: value }))}
                />
                <NumberField
                  label="Opacity"
                  value={selectedTemplateElement.opacity}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, opacity: value }))}
                />
                <NumberField
                  label="Rotation"
                  value={selectedTemplateElement.rotation}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, rotation: value }))}
                />
              </div>

              <SwitchRow
                label="Visible"
                checked={selectedTemplateElement.visible}
                onCheckedChange={(checked) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, visible: checked }))}
              />

              {selectedElementInspector}
            </CardContent>
          </Card>
        ) : null}
      </>
    );
  }, [
    addTemplateElement,
    openTemplateImagePicker,
    removeTemplateElement,
    selectedDeviceSpec.width,
    selectedElementFontOptions,
    selectedSlotBackground,
    selectedSlotData,
    selectedTemplateElement,
    setSelectedTemplateElementId,
    templateElements,
    updateTemplateBackground,
    updateTemplateElement
  ]);

  function renderSelectedInspector() {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Selected Screen Inspector</CardTitle>
            <CardDescription>
              {selectedSlotData ? `${selectedSlotData.name} · ${selectedLocale}` : '선택된 슬롯이 없습니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedSlotData ? (
              <>
                <LabeledField label="Slot Name">
                  <Input
                    value={selectedSlotNameDraft}
                    onChange={(event) => setSelectedSlotNameDraft(event.target.value)}
                    onBlur={commitSelectedSlotName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitSelectedSlotName();
                        return;
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setSelectedSlotNameDraft(selectedSlotData.name);
                      }
                    }}
                  />
                </LabeledField>

                <LabeledField label="Slot Image">
                  <div className="space-y-2">
                    <p className="truncate rounded-md border bg-muted/60 p-2 text-xs">
                      {selectedSlotData.sourceImagePath || 'No slot image selected'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSlotImagePicker(selectedSlotData.id)}
                    >
                      Choose Image
                    </Button>
                  </div>
                </LabeledField>

                <InspectorCopyFields
                  locale={selectedLocale}
                  titleValue={doc.copy.keys[fieldKey(selectedSlotData.id, 'title')]?.[selectedLocale] || ''}
                  subtitleValue={doc.copy.keys[fieldKey(selectedSlotData.id, 'subtitle')]?.[selectedLocale] || ''}
                  onTitleChange={handleSelectedTitleChange}
                  onSubtitleChange={handleSelectedSubtitleChange}
                />

                <div className="flex flex-wrap gap-2">
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
    <div className="grid min-h-screen w-full max-w-none gap-4 p-4 lg:p-6">
      <input
        ref={slotImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => { void handleSlotImageFileChange(event); }}
      />

      <input
        ref={templateImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => { void handleTemplateImageFileChange(event); }}
      />

      <div className="relative">
        <div className="pointer-events-none fixed left-3 top-3 z-40 w-[220px]">
          <div className="pointer-events-auto space-y-2">
            <Card className="border bg-card/95 shadow-xl backdrop-blur">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm tracking-tight">Store Metadata Studio</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 pt-0">
                <p className="truncate text-[11px] text-muted-foreground" title={projectPath || ''}>
                  {projectPath || 'Project path: unsaved project'}
                </p>
                <Button size="sm" disabled={isBusy} variant="outline" onClick={handleLoadProject}><FolderDown className="mr-1 h-3.5 w-3.5" />Load</Button>
                <Button size="sm" disabled={isBusy} variant="outline" onClick={() => {
                  void handleSaveProject();
                }}><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
                <Button size="sm" disabled={isBusy} onClick={handleCreateNewProject}><FolderUp className="mr-1 h-3.5 w-3.5" />New</Button>
                <Button size="sm" variant="secondary" onClick={handleOpenOnboarding}>Setup</Button>
                {projectStatus ? (
                  <p className="text-[11px] text-muted-foreground">{projectStatus}</p>
                ) : null}
                {projectError ? (
                  <p className="text-[11px] text-red-600">{projectError}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border bg-card/90 shadow-xl backdrop-blur">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm tracking-tight">Workflow</CardTitle>
                <CardDescription className="text-xs">Step {activeStepIndex + 1} / {steps.length}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {steps.map((step, index) => {
                  const isCurrent = index === activeStepIndex;
                  const isCompleted = index < activeStepIndex;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isCurrent
                          ? 'border-primary bg-primary/10'
                          : isCompleted
                            ? 'border-border bg-muted/40'
                            : 'border-border bg-background/60'
                        }`}
                    >
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{step.title}</p>
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={isBusy || isFirstStep} onClick={goPrevStep}>
                    Previous
                  </Button>
                  <Button size="sm" disabled={isBusy || isLastStep} onClick={goNextStep}>
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className={activeStep === 'screens' ? 'space-y-4' : 'space-y-4 pt-2 lg:pl-[250px]'}>
          {activeStep === 'screens' ? (
            <ScreensWorkflowPage
              canvasNode={(
                <InfiniteSlotCanvas
                  className="h-full w-full"
                  focusTrigger={screenFocusTrigger}
                  items={screenCanvasSlots}
                  positions={slotCanvasPositions}
                  cardWidth={slotCanvasCardSize.width}
                  cardHeight={slotCanvasCardSize.height}
                  selectedSlot={selectedSlot}
                  templateImageUrls={templateImageUrls}
                  device={selectedDeviceSpec}
                  onSelect={handleSelectSlot}
                  onReorder={reorderSlotByDrag}
                  onRename={renameSlot}
                  selectedTemplateElementId={selectedTemplateElementId}
                  onSelectTemplateElement={setSelectedTemplateElementId}
                  onMoveTemplateElement={moveTemplateElement}
                />
              )}
              inspectorNode={renderSelectedInspector()}
              isXlLayout={isXlLayout}
              selectedDevice={selectedDevice}
              selectedSlot={selectedSlot}
              slotCount={slots.length}
              deviceOptions={doc.project.devices.map((device) => ({ value: device.id, label: device.id }))}
              slotOptions={slots.map((slot) => ({ value: slot.id, label: slot.name }))}
              onSelectDevice={setSelectedDevice}
              onSelectSlot={handleSelectSlot}
              onAddSlot={addSlot}
            />
          ) : null}

          {activeStep === 'localization' ? (
            <LocalizationWorkflowPage
              sourceLocale={doc.pipelines.localization.sourceLocale || doc.project.locales[0] || 'en-US'}
              isBusy={isBusy}
              isRunningLocalization={isBusy}
              localizationBusyLabel={isBusy ? busyDetail : ''}
              llmConfig={llmConfig}
              slots={slots.map((slot) => ({ id: slot.id, name: slot.name }))}
              locales={doc.project.locales}
              localeManagerNode={(
                <LocaleSelector
                  value={doc.project.locales}
                  options={localePresets}
                  onChange={(locales) => updateDoc((next) => {
                    if (locales.length === 0) return;
                    next.project.locales = locales;
                  })}
                />
              )}
              onSourceLocaleChange={(locale) => updateDoc((next) => {
                next.pipelines.localization.sourceLocale = locale;
              })}
              onRunLocalization={handleRunLocalization}
              onLlmCommandChange={(value) => upsertLlmConfig((cfg) => { cfg.command = value; })}
              onLlmTimeoutSecChange={(value) => upsertLlmConfig((cfg) => { cfg.timeoutSec = value; })}
              onLlmPromptChange={(value) => upsertLlmConfig((cfg) => { cfg.prompt = value; })}
              getCopyValue={(key, locale) => doc.copy.keys[key]?.[locale] || ''}
              onCopyChange={updateCopyByKey}
            />
          ) : null}

          {activeStep === 'preview' ? (
            <PreviewWorkflowPage
              deviceOptions={doc.project.devices.map((device) => ({ value: device.id, label: device.id }))}
              selectedDevice={selectedDevice}
              onSelectDevice={setSelectedDevice}
              localeOptions={doc.project.locales.map((locale) => ({ value: locale, label: locale }))}
              slotOptions={doc.project.slots.map((slot) => ({ value: slot.id, label: slot.name }))}
              previewPath={previewPath}
              renderSlotPreviewCard={renderPreviewSlotCard}
            />
          ) : null}

          {activeStep === 'export' ? (
            <ExportWorkflowPage
              outputDir={outputDir}
              zipEnabled={doc.pipelines.export.zip}
              metadataCsvEnabled={doc.pipelines.export.metadataCsv}
              isBusy={isBusy}
              exportStatus={exportStatus}
              exportError={exportError}
              onOutputDirChange={setOutputDir}
              onPickOutputDir={handlePickOutputDir}
              canPickOutputDir={isTauriRuntime()}
              onZipEnabledChange={(checked) => updateDoc((next) => { next.pipelines.export.zip = checked; })}
              onMetadataCsvEnabledChange={(checked) => updateDoc((next) => { next.pipelines.export.metadataCsv = checked; })}
              onExport={handleExport}
            />
          ) : null}

        </div>
      </div>

      {isBusy ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-[440px] shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="h-4 w-4 animate-spin" />
                {busyTitle || 'Processing'}
              </CardTitle>
              <CardDescription>{busyDetail || '작업을 실행하고 있습니다. 잠시만 기다려 주세요.'}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {isOnboardingOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-[760px] shadow-2xl">
            <CardHeader>
              <CardTitle>Welcome to Store Metadata Studio</CardTitle>
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

interface CanvasSlotItem {
  slot: Slot;
  titleValue: string;
  subtitleValue: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  template: TemplateMain;
}

interface InfiniteSlotCanvasProps {
  className?: string;
  focusTrigger?: number;
  items: CanvasSlotItem[];
  positions: Record<string, SlotCanvasPosition>;
  cardWidth: number;
  cardHeight: number;
  selectedSlot: string;
  templateImageUrls: Record<string, string>;
  device: Device;
  onSelect: (slotId: string) => void;
  onReorder: (slotId: string, targetIndex: number) => void;
  onRename: (slotId: string, nextName: string) => void;
  selectedTemplateElementId: string;
  onSelectTemplateElement: (elementId: string) => void;
  onMoveTemplateElement: (elementId: string, x: number, y: number) => void;
}

const InfiniteSlotCanvas = memo(function InfiniteSlotCanvas({
  className,
  focusTrigger,
  items,
  positions,
  cardWidth,
  cardHeight,
  selectedSlot,
  templateImageUrls,
  device,
  onSelect,
  onReorder,
  onRename,
  selectedTemplateElementId,
  onSelectTemplateElement,
  onMoveTemplateElement
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
    startIndex: number;
    lastTargetIndex: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ slotId: string; x: number; y: number } | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState('');
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const spacePanRef = useRef(false);
  const boardTransformRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const viewportOffsetRef = useRef<SlotCanvasPosition>({ x: 0, y: 0 });
  const transformFrameRef = useRef<number | null>(null);
  const focusAnimationFrameRef = useRef<number | null>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const pendingDragPreviewRef = useRef<{ slotId: string; x: number; y: number } | null>(null);
  const focusViewportOnSlotsRef = useRef<(behavior?: ScrollBehavior) => void>(() => {});
  const suppressNextSelectionCenterRef = useRef(false);

  const clampZoom = useCallback((value: number) => {
    return Math.min(SLOT_CANVAS_MAX_ZOOM, Math.max(SLOT_CANVAS_MIN_ZOOM, value));
  }, []);

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

  const boardContentStyle = useMemo<CSSProperties>(() => ({
    ...boardStyle,
    width: SLOT_CANVAS_WIDTH,
    height: SLOT_CANVAS_HEIGHT
  }), [boardStyle]);

  const boardTransformStyle = useMemo<CSSProperties>(() => ({
    width: SLOT_CANVAS_WIDTH,
    height: SLOT_CANVAS_HEIGHT,
    transformOrigin: 'top left',
    transform: 'translate(0px, 0px) scale(1)',
    willChange: 'transform'
  }), []);

  const getViewportScrollBounds = useCallback((zoomValue: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return { maxX: 0, maxY: 0 };
    }

    return {
      maxX: Math.max(0, SLOT_CANVAS_WIDTH * zoomValue - viewport.clientWidth),
      maxY: Math.max(0, SLOT_CANVAS_HEIGHT * zoomValue - viewport.clientHeight)
    };
  }, []);

  const flushBoardTransform = useCallback(() => {
    transformFrameRef.current = null;
    const board = boardTransformRef.current;
    if (!board) return;

    const offset = viewportOffsetRef.current;
    const currentZoom = zoomRef.current;
    board.style.transform = `translate(${-offset.x}px, ${-offset.y}px) scale(${currentZoom})`;
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  }, []);

  const scheduleBoardTransform = useCallback(() => {
    if (transformFrameRef.current != null) return;
    transformFrameRef.current = window.requestAnimationFrame(flushBoardTransform);
  }, [flushBoardTransform]);

  const cancelFocusAnimation = useCallback(() => {
    if (focusAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(focusAnimationFrameRef.current);
      focusAnimationFrameRef.current = null;
    }
  }, []);

  const setViewportOffset = useCallback((x: number, y: number, zoomValue: number = zoomRef.current) => {
    const { maxX, maxY } = getViewportScrollBounds(zoomValue);
    const next: SlotCanvasPosition = {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    };

    viewportOffsetRef.current = next;
    scheduleBoardTransform();

    return next;
  }, [getViewportScrollBounds, scheduleBoardTransform]);

  useEffect(() => {
    scheduleBoardTransform();
    return () => {
      if (transformFrameRef.current != null) {
        window.cancelAnimationFrame(transformFrameRef.current);
        transformFrameRef.current = null;
      }
    };
  }, [scheduleBoardTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setViewportOffset(viewportOffsetRef.current.x, viewportOffsetRef.current.y, zoomRef.current);
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [setViewportOffset]);

  const focusViewportOnSlots = useCallback((behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport || items.length === 0) return;
    cancelFocusAnimation();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const [index, item] of items.entries()) {
      const position = resolveSlotCanvasPosition(positions, item.slot.id, index, cardWidth);
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + cardWidth);
      maxY = Math.max(maxY, position.y + cardHeight);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const centerX = ((minX + maxX) / 2) * zoomRef.current;
    const centerY = ((minY + maxY) / 2) * zoomRef.current;
    const targetX = centerX - viewport.clientWidth / 2;
    const targetY = centerY - viewport.clientHeight / 2;

    if (behavior === 'smooth') {
      const start = viewportOffsetRef.current;
      const deltaX = targetX - start.x;
      const deltaY = targetY - start.y;
      const startTime = performance.now();
      const duration = 180;

      const tick = (now: number) => {
        if (dragRef.current) {
          focusAnimationFrameRef.current = null;
          return;
        }
        const progress = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        setViewportOffset(start.x + deltaX * ease, start.y + deltaY * ease, zoomRef.current);
        if (progress < 1) {
          focusAnimationFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          focusAnimationFrameRef.current = null;
        }
      };

      focusAnimationFrameRef.current = window.requestAnimationFrame(tick);
      return;
    }

    if (dragRef.current) return;
    setViewportOffset(targetX, targetY, zoomRef.current);
  }, [cancelFocusAnimation, cardHeight, cardWidth, items, positions, setViewportOffset]);

  useEffect(() => {
    focusViewportOnSlotsRef.current = focusViewportOnSlots;
  }, [focusViewportOnSlots]);

  const applyZoomAtPoint = useCallback((nextZoomValue: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(nextZoomValue);
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const currentOffset = viewportOffsetRef.current;
    const worldX = (currentOffset.x + pointX) / currentZoom;
    const worldY = (currentOffset.y + pointY) / currentZoom;

    zoomRef.current = nextZoom;
    setViewportOffset(worldX * nextZoom - pointX, worldY * nextZoom - pointY, nextZoom);
  }, [clampZoom, setViewportOffset]);

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

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    return {
      x: (viewportOffsetRef.current.x + pointX) / zoomRef.current,
      y: (viewportOffsetRef.current.y + pointY) / zoomRef.current
    };
  }, []);

  const commitDragPreview = useCallback((slotId: string, x: number, y: number) => {
    setDragPreview((current) => {
      if (!current || current.slotId !== slotId) {
        return { slotId, x, y };
      }
      if (Math.abs(current.x - x) < 0.01 && Math.abs(current.y - y) < 0.01) {
        return current;
      }
      return { ...current, x, y };
    });
  }, []);

  const flushDragPreview = useCallback(() => {
    dragPreviewFrameRef.current = null;
    const pending = pendingDragPreviewRef.current;
    pendingDragPreviewRef.current = null;
    if (!pending) return;
    commitDragPreview(pending.slotId, pending.x, pending.y);

    const state = dragRef.current;
    if (!state || state.slotId !== pending.slotId) return;

    const dragCenterX = pending.x + cardWidth / 2;
    const dragCenterY = pending.y + cardHeight / 2;
    let targetIndex = state.lastTargetIndex;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < items.length; index += 1) {
      const position = defaultSlotCanvasPosition(index, cardWidth);
      const centerX = position.x + cardWidth / 2;
      const centerY = position.y + cardHeight / 2;
      const distance = ((dragCenterX - centerX) ** 2) + ((dragCenterY - centerY) ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        targetIndex = index;
      }
    }

    if (targetIndex !== state.lastTargetIndex) {
      state.lastTargetIndex = targetIndex;
    }
  }, [cardHeight, cardWidth, commitDragPreview, items]);

  const scheduleDragPreview = useCallback((slotId: string, x: number, y: number) => {
    pendingDragPreviewRef.current = { slotId, x, y };
    if (dragPreviewFrameRef.current != null) return;
    dragPreviewFrameRef.current = window.requestAnimationFrame(flushDragPreview);
  }, [flushDragPreview]);

  const cancelScheduledDragPreview = useCallback(() => {
    pendingDragPreviewRef.current = null;
    if (dragPreviewFrameRef.current != null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
  }, []);

  const commitSlotNameEdit = useCallback((slotId: string) => {
    const nextName = editingSlotName.trim();
    setEditingSlotId(null);
    setEditingSlotName('');
    if (!nextName) return;
    onRename(slotId, nextName);
  }, [editingSlotName, onRename]);

  const cancelSlotNameEdit = useCallback(() => {
    setEditingSlotId(null);
    setEditingSlotName('');
  }, []);

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (dragRef.current) return;

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

    event.preventDefault();
    event.stopPropagation();
    setViewportOffset(
      viewportOffsetRef.current.x + horizontal,
      viewportOffsetRef.current.y + vertical,
      zoomRef.current
    );
  }, [applyZoomAtPoint, resolveWheelAnchor, setViewportOffset]);

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
      const targetElement = target instanceof Element ? target : null;
      if (targetElement?.closest('[data-native-wheel]')) {
        return;
      }
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
    const acceleratedScale = scale >= 1
      ? 1 + ((scale - 1) * PINCH_ZOOM_ACCELERATION)
      : Math.max(0.1, 1 - ((1 - scale) * PINCH_ZOOM_ACCELERATION));
    const nextZoom = pinchRef.current.startZoom * acceleratedScale;
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
    if (editingSlotId === slotId) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    const slotIndex = items.findIndex((item) => item.slot.id === slotId);
    if (slotIndex < 0) return;
    const basePosition = resolveSlotCanvasPosition(positions, slotId, slotIndex, cardWidth);
    const worldPoint = toWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) return;

    dragRef.current = {
      slotId,
      pointerId: event.pointerId,
      startIndex: slotIndex,
      lastTargetIndex: slotIndex,
      pointerOffsetX: worldPoint.x - basePosition.x,
      pointerOffsetY: worldPoint.y - basePosition.y
    };
    cancelScheduledDragPreview();
    commitDragPreview(slotId, basePosition.x, basePosition.y);
    panRef.current = null;
    cancelFocusAnimation();
    suppressNextSelectionCenterRef.current = true;
    // Keep selection ref in sync to avoid post-drag auto-centering jump.
    selectedSlotRef.current = slotId;

    onSelect(slotId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }, [cancelFocusAnimation, cancelScheduledDragPreview, cardWidth, commitDragPreview, editingSlotId, items, onSelect, positions, toWorldPoint]);

  const handleDragPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const worldPoint = toWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) return;
    const previewX = worldPoint.x - state.pointerOffsetX;
    const previewY = worldPoint.y - state.pointerOffsetY;

    scheduleDragPreview(state.slotId, previewX, previewY);

    event.stopPropagation();
    event.preventDefault();
  }, [scheduleDragPreview, toWorldPoint]);

  const handleDragPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    dragRef.current = null;
    cancelScheduledDragPreview();
    setDragPreview(null);
    if (state.lastTargetIndex !== state.startIndex) {
      onReorder(state.slotId, state.lastTargetIndex);
    }
    if (selectedSlot === state.slotId) {
      suppressNextSelectionCenterRef.current = false;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
    event.preventDefault();
  }, [cancelScheduledDragPreview, onReorder, selectedSlot]);

  useEffect(() => {
    return () => {
      if (focusAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(focusAnimationFrameRef.current);
      }
      if (dragPreviewFrameRef.current != null) {
        window.cancelAnimationFrame(dragPreviewFrameRef.current);
      }
      pendingDragPreviewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dragPreview) return;
    if (items.some((item) => item.slot.id === dragPreview.slotId)) return;
    dragRef.current = null;
    cancelScheduledDragPreview();
    setDragPreview(null);
  }, [cancelScheduledDragPreview, dragPreview, items]);

  useEffect(() => {
    if (!editingSlotId) return;
    if (items.some((item) => item.slot.id === editingSlotId)) return;
    setEditingSlotId(null);
    setEditingSlotName('');
  }, [editingSlotId, items]);

  const handleViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
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
      startLeft: viewportOffsetRef.current.x,
      startTop: viewportOffsetRef.current.y
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (dragRef.current) return;

    setViewportOffset(
      state.startLeft - (event.clientX - state.startClientX),
      state.startTop - (event.clientY - state.startClientY),
      zoomRef.current
    );
    event.preventDefault();
  }, [setViewportOffset]);

  const handleViewportPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (delayMs: number) => {
      const timerId = window.setTimeout(() => {
        focusViewportOnSlotsRef.current('auto');
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
  }, [focusTrigger]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const previous = selectedSlotRef.current;
    selectedSlotRef.current = selectedSlot;
    if (dragRef.current) return;
    if (previous === selectedSlot) return;
    if (suppressNextSelectionCenterRef.current) {
      suppressNextSelectionCenterRef.current = false;
      return;
    }

    const position = positions[selectedSlot];
    if (!position) return;

    const left = viewportOffsetRef.current.x;
    const top = viewportOffsetRef.current.y;
    const right = left + viewport.clientWidth;
    const bottom = top + viewport.clientHeight;
    const scaledX = position.x * zoomRef.current;
    const scaledY = position.y * zoomRef.current;
    const scaledWidth = cardWidth * zoomRef.current;
    const scaledHeight = cardHeight * zoomRef.current;
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

    setViewportOffset(
      nodeLeft - viewport.clientWidth / 2 + scaledWidth / 2,
      nodeTop - viewport.clientHeight / 2 + scaledHeight / 2,
      zoomRef.current
    );
  }, [cardHeight, cardWidth, positions, selectedSlot, setViewportOffset]);

  const dragCursorClass = dragPreview ? 'cursor-grabbing' : '';
  const viewportClassName = className
    ? `relative overflow-hidden overscroll-none ${dragCursorClass} ${className}`
    : `relative h-[78vh] overflow-hidden overscroll-none rounded-md border bg-muted/20 ${dragCursorClass}`;

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
      <div ref={boardTransformRef} className="absolute left-0 top-0" style={boardTransformStyle}>
        <div className="relative" style={boardContentStyle}>
          {items.map((item, index) => {
            const position = resolveSlotCanvasPosition(positions, item.slot.id, index, cardWidth);
            const dragState = dragRef.current;
            const isDragging = dragPreview?.slotId === item.slot.id;
            const isSelected = selectedSlot === item.slot.id;
            const isEditing = editingSlotId === item.slot.id;
            const slotLabel = item.slot.name;
            const draggedOffsetX = isDragging && dragPreview ? dragPreview.x - position.x : 0;
            const draggedOffsetY = isDragging && dragPreview ? dragPreview.y - position.y : 0;

            let displacedOffsetX = 0;
            let displacedOffsetY = 0;
            if (!isDragging && dragState && dragState.startIndex !== dragState.lastTargetIndex) {
              let previewIndex = index;

              if (dragState.startIndex < dragState.lastTargetIndex) {
                if (index > dragState.startIndex && index <= dragState.lastTargetIndex) {
                  previewIndex = index - 1;
                }
              } else if (dragState.startIndex > dragState.lastTargetIndex) {
                if (index >= dragState.lastTargetIndex && index < dragState.startIndex) {
                  previewIndex = index + 1;
                }
              }

              if (previewIndex !== index) {
                const previewPosition = defaultSlotCanvasPosition(previewIndex, cardWidth);
                displacedOffsetX = previewPosition.x - position.x;
                displacedOffsetY = previewPosition.y - position.y;
              }
            }

            const headerOffsetX = isDragging ? draggedOffsetX : displacedOffsetX;
            const headerOffsetY = isDragging ? draggedOffsetY : displacedOffsetY;
            const cardStyle: CSSProperties = {
              left: position.x,
              top: position.y,
              width: cardWidth
            };
            const dragHandleStyle: CSSProperties = isDragging
              ? {
                position: 'relative',
                zIndex: 40,
                transform: `translate3d(${headerOffsetX}px, ${headerOffsetY}px, 0)`,
                willChange: 'transform'
              }
              : {
                position: 'relative',
                zIndex: displacedOffsetX !== 0 || displacedOffsetY !== 0 ? 30 : 1,
                transform: `translate3d(${headerOffsetX}px, ${headerOffsetY}px, 0)`,
                transition: 'transform 120ms ease'
              };

            return (
              <div
                key={item.slot.id}
                data-slot-card
                className={`absolute ${isDragging ? 'z-30' : ''}`}
                style={cardStyle}
              >
                {isEditing ? (
                  <div
                    className="mb-2 rounded-md border border-primary/70 bg-primary/10 p-1.5"
                    style={dragHandleStyle}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Input
                      value={editingSlotName}
                      onChange={(event) => setEditingSlotName(event.target.value)}
                      onBlur={() => commitSlotNameEdit(item.slot.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitSlotNameEdit(item.slot.id);
                          return;
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelSlotNameEdit();
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      autoFocus
                      className="h-7 text-xs"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`mb-2 flex w-full items-center justify-between rounded-md border px-2 py-1 text-[11px] ${
                      isDragging
                        ? 'cursor-grabbing border-primary/70 bg-primary/15 text-primary shadow-xl'
                        : isSelected
                          ? 'cursor-grab border-primary/60 bg-primary/10 text-primary shadow-md'
                          : 'cursor-grab border-border bg-card/90 shadow-sm backdrop-blur hover:bg-card'
                    }`}
                    style={dragHandleStyle}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditingSlotId(item.slot.id);
                      setEditingSlotName(slotLabel);
                    }}
                    onPointerDown={(event) => handleDragPointerDown(event, item.slot.id)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerEnd}
                    onPointerCancel={handleDragPointerEnd}
                  >
                    <span className={`font-medium ${isDragging || isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {slotLabel}
                    </span>
                  </button>
                )}

                <div className={isDragging ? 'rounded-md ring-2 ring-primary/35 shadow-2xl' : ''}>
                  <SlotCard
                    slot={item.slot}
                    titleValue={item.titleValue}
                    subtitleValue={item.subtitleValue}
                    renderedPreviewUrl={item.renderedPreviewUrl}
                    sourceImageUrl={item.sourceImageUrl}
                    template={item.template}
                    templateImageUrls={templateImageUrls}
                    device={device}
                    onSelect={onSelect}
                    editable={isSelected}
                    selectedElementId={selectedTemplateElementId}
                    onSelectElement={onSelectTemplateElement}
                    onMoveElement={onMoveTemplateElement}
                  />
                </div>
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
            <span ref={zoomLabelRef}>100%</span>
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => focusViewportOnSlots('smooth')}>
            Fit
          </Button>
        </div>
      </div>
    </div>
  );
});
