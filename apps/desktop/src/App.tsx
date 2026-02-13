import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { LocaleSelector } from './components/form/InspectorControls';
import { ExportWorkflowPage } from './workflows/ExportWorkflowPage';
import { LocalizationWorkflowPage } from './workflows/LocalizationWorkflowPage';
import { PreviewWorkflowPage } from './workflows/PreviewWorkflowPage';
import { ScreensWorkflowPage } from './workflows/ScreensWorkflowPage';
import { SlotRenderPreview } from './components/preview/SlotPreview';
import { InfiniteSlotCanvas, type CanvasSlotItem } from './components/canvas/InfiniteSlotCanvas';
import { SelectedScreenInspector } from './components/inspector/SelectedScreenInspector';
import { TemplateInspectorSection } from './components/inspector/TemplateInspectorSection';
import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay';
import { BusyOverlay } from './components/overlay/BusyOverlay';
import { WorkflowSidebar } from './components/sidebar/WorkflowSidebar';
import { useProjectImageAssets } from './hooks/useProjectImageAssets';
import { useProjectBootstrapPaths } from './hooks/useProjectBootstrapPaths';
import { useBusyRunner } from './hooks/useBusyRunner';
import { useExportAction } from './hooks/useExportAction';
import { useProjectFileActions } from './hooks/useProjectFileActions';
import { useProjectImageUploadHandlers } from './hooks/useProjectImageUploadHandlers';
import { usePipelineActions } from './hooks/usePipelineActions';
import { usePreviewLoaders } from './hooks/usePreviewLoaders';
import { resolveOutputDir as resolveOutputDirPath } from './lib/output-dir';
import {
  applyAddSlot,
  applyMoveSlot,
  applyRemoveSlot,
  applyToggleDevicePreset,
  applyTogglePlatform
} from './lib/slot-editor';
import {
  isTauriRuntime,
  listSystemFonts,
  pickOutputDir,
  writeTextFile
} from './lib/desktop-runtime';
import {
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
  asNumber,
  buildProjectSnapshotForPersistence,
  clampNumber,
  clone,
  cloneTemplateElements,
  createDefaultProject,
  defaultSlotCanvasPosition,
  defaultLlmConfig,
  defaultSystemFonts,
  detectPlatformFromDeviceId,
  fieldKey,
  getSlotCanvasCardSize,
  getSlotPreviewCanvasSize,
  imageMimeTypeFromPath,
  localePresets,
  normalizeProject,
  normalizeTemplateElementOrder,
  reorderSlots,
  resolveImageLayerForPreview,
  resolveNextSlotIdentity,
  resolveTemplateElementsForSlot,
  resolveTextWidthFromPercent,
  resolveTextLayerWithinSlot,
  serializeProjectSignature,
  sortSlotsByOrder,
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

const steps: Array<{ id: StepId; title: string }> = [
  { id: 'screens', title: 'Screens' },
  { id: 'localization', title: 'Localization' },
  { id: 'preview', title: 'Preview / Validate' },
  { id: 'export', title: 'Export' }
];

const XL_MEDIA_QUERY = '(min-width: 1280px)';
const ONBOARDING_STORAGE_KEY = 'storeshot.desktop.onboarding.v1.completed';
const DEFAULT_PROJECT_FILE_NAME = 'project.storeshot.json';

export function App() {
  const [activeStep, setActiveStep] = useState<StepId>('screens');
  const [projectPath, setProjectPath] = useState('');
  const [savedProjectSignature, setSavedProjectSignature] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState('');
  const [projectError, setProjectError] = useState('');
  const [doc, setDoc] = useState<StoreShotDoc>(() => createDefaultProject());
  const [outputDir, setOutputDir] = useState('dist');
  const [isBusy, setIsBusy] = useState(false);
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
  const [, startSlotTransition] = useTransition();
  const [, startTemplateTransition] = useTransition();
  const runWithBusy = useBusyRunner({
    setIsBusy,
    setBusyTitle,
    setBusyDetail
  });

  const { defaultExportDir, isProjectBaselineReady } = useProjectBootstrapPaths({
    defaultProjectFileName: DEFAULT_PROJECT_FILE_NAME,
    setOutputDir,
    setProjectPath
  });

  const resolveOutputDir = useCallback((value: string | undefined) => {
    return resolveOutputDirPath(value, defaultExportDir);
  }, [defaultExportDir]);

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
  const { handleLoadProject, handleSaveProject, handleCreateNewProject } = useProjectFileActions({
    projectPath,
    outputDir,
    defaultExportDir,
    defaultProjectFileName: DEFAULT_PROJECT_FILE_NAME,
    hasUnsavedChanges,
    doc,
    resolveOutputDir,
    runWithBusy,
    setDoc,
    setOutputDir,
    setIssues,
    setProjectPath,
    setSavedProjectSignature,
    setProjectError,
    setProjectStatus
  });

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
  const {
    slotSourceUrls,
    setSlotSourceUrls,
    templateImageUrls,
    setTemplateImageUrls
  } = useProjectImageAssets({
    slots: doc.project.slots,
    templateMain: doc.template.main
  });
  const { loadSlotPreviewMap, loadPreviewMatrix } = usePreviewLoaders({
    slots: doc.project.slots,
    locales: doc.project.locales,
    previewRenderDir,
    selectedPlatform,
    selectedDevice,
    selectedLocale,
    selectedSlot,
    setSlotPreviewUrls,
    setSlotPreviewPaths,
    setPreviewMatrixUrls,
    setPreviewMatrixPaths
  });
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

  function togglePlatform(platform: Platform, checked: boolean) {
    updateDoc((next) => {
      applyTogglePlatform(next, platform, checked);
    });
  }

  function toggleDevicePreset(presetDevice: Device, checked: boolean) {
    updateDoc((next) => {
      applyToggleDevicePreset(next, presetDevice, checked);
    });
  }

  function moveSlot(slotId: string, direction: -1 | 1) {
    updateDoc((next) => {
      applyMoveSlot(next, slotId, direction);
    });
  }

  function openSlotImagePicker(slotId: string) {
    slotImageTargetRef.current = slotId;
    slotImageInputRef.current?.click();
  }

  function addSlot() {
    let createdSlotId = '';

    updateDoc((next) => {
      createdSlotId = applyAddSlot(next);
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
      applyRemoveSlot(next, slotId);
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
  const handleExport = useExportAction({
    doc,
    outputDir,
    previewRenderDir,
    projectPath,
    templateImageUrls,
    resolveOutputDir,
    runWithBusy,
    persistProjectSnapshot,
    setOutputDir,
    setExportStatus,
    setExportError
  });

  const { handleRunLocalization, handleRender, handleValidate, handleRefreshPreview } = usePipelineActions({
    projectPath,
    previewRenderDir,
    runWithBusy,
    persistProjectSnapshot,
    loadSlotPreviewMap,
    loadPreviewMatrix,
    setDoc,
    setIssues
  });

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

  const { handleSlotImageFileChange, handleTemplateImageFileChange } = useProjectImageUploadHandlers({
    runWithBusy,
    updateDoc,
    updateTemplateElement,
    setSlotSourceUrls,
    setTemplateImageUrls,
    slotImageTargetRef,
    templateImageTargetRef,
    selectedTemplateSlotId: selectedSlotData?.id || selectedSlot
  });

  const templateInspectorSection = (
    <TemplateInspectorSection
      addTemplateElement={addTemplateElement}
      openTemplateImagePicker={openTemplateImagePicker}
      removeTemplateElement={removeTemplateElement}
      selectedDeviceSpecWidth={selectedDeviceSpec.width}
      selectedElementFontOptions={selectedElementFontOptions}
      selectedSlotBackground={selectedSlotBackground}
      selectedSlotData={selectedSlotData}
      selectedTemplateElement={selectedTemplateElement}
      setSelectedTemplateElementId={setSelectedTemplateElementId}
      templateElements={templateElements}
      updateTemplateBackground={updateTemplateBackground}
      updateTemplateElement={updateTemplateElement}
    />
  );

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
        <WorkflowSidebar
          projectPath={projectPath}
          isBusy={isBusy}
          projectStatus={projectStatus}
          projectError={projectError}
          steps={steps}
          activeStepIndex={activeStepIndex}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onLoad={handleLoadProject}
          onSave={() => handleSaveProject()}
          onNew={handleCreateNewProject}
          onSetup={handleOpenOnboarding}
          onPrev={goPrevStep}
          onNext={goNextStep}
        />

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
              inspectorNode={(
                <SelectedScreenInspector
                  selectedSlotData={selectedSlotData}
                  selectedLocale={selectedLocale}
                  selectedSlotNameDraft={selectedSlotNameDraft}
                  titleValue={selectedSlotData ? (doc.copy.keys[fieldKey(selectedSlotData.id, 'title')]?.[selectedLocale] || '') : ''}
                  subtitleValue={selectedSlotData ? (doc.copy.keys[fieldKey(selectedSlotData.id, 'subtitle')]?.[selectedLocale] || '') : ''}
                  isMoveUpDisabled={slots[0]?.id === selectedSlotData?.id}
                  isMoveDownDisabled={slots[slots.length - 1]?.id === selectedSlotData?.id}
                  templateInspectorNode={templateInspectorSection}
                  onSlotNameDraftChange={setSelectedSlotNameDraft}
                  onCommitSlotName={commitSelectedSlotName}
                  onResetSlotNameDraft={() => {
                    if (!selectedSlotData) return;
                    setSelectedSlotNameDraft(selectedSlotData.name);
                  }}
                  onOpenSlotImagePicker={openSlotImagePicker}
                  onTitleChange={handleSelectedTitleChange}
                  onSubtitleChange={handleSelectedSubtitleChange}
                  onMoveSlotUp={() => {
                    if (!selectedSlotData) return;
                    moveSlot(selectedSlotData.id, -1);
                  }}
                  onMoveSlotDown={() => {
                    if (!selectedSlotData) return;
                    moveSlot(selectedSlotData.id, 1);
                  }}
                  onRemoveSlot={() => {
                    if (!selectedSlotData) return;
                    removeSlot(selectedSlotData.id);
                  }}
                />
              )}
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

      <BusyOverlay
        open={isBusy}
        title={busyTitle || 'Processing'}
        detail={busyDetail || '작업을 실행하고 있습니다. 잠시만 기다려 주세요.'}
      />

      <OnboardingOverlay
        open={isOnboardingOpen}
        locales={doc.project.locales}
        localeOptions={localePresets}
        platforms={doc.project.platforms}
        devices={doc.project.devices}
        ready={onboardingReady}
        onLocalesChange={(locales) => updateDoc((next) => { next.project.locales = locales; })}
        onPlatformToggle={togglePlatform}
        onDeviceToggle={toggleDevicePreset}
        onStart={handleCompleteOnboarding}
      />
    </div>
  );
}
