import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { LocaleSelector } from './components/form/InspectorControls';
import { ExportWorkflowPage } from './workflows/ExportWorkflowPage';
import { LocalizationWorkflowPage } from './workflows/LocalizationWorkflowPage';
import { PreviewWorkflowPage } from './workflows/PreviewWorkflowPage';
import { ScreensWorkflowPage } from './workflows/ScreensWorkflowPage';
import { InfiniteSlotCanvas } from './components/canvas/InfiniteSlotCanvas';
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
import { useOnboardingActions } from './hooks/useOnboardingActions';
import { useProjectSlotActions } from './hooks/useProjectSlotActions';
import { usePreviewLoaders } from './hooks/usePreviewLoaders';
import { useScreenWorkflowState } from './hooks/useScreenWorkflowState';
import { useTemplateEditorActions } from './hooks/useTemplateEditorActions';
import { resolveOutputDir as resolveOutputDirPath } from './lib/output-dir';
import {
  isTauriRuntime,
  listSystemFonts,
  pickOutputDir,
  writeTextFile
} from './lib/desktop-runtime';
import {
  type Device,
  type Platform,
  type StoreShotDoc,
  buildProjectSnapshotForPersistence,
  clone,
  createDefaultProject,
  defaultLlmConfig,
  defaultSystemFonts,
  detectPlatformFromDeviceId,
  fieldKey,
  localePresets,
  normalizeTemplateElementOrder,
  resolveTemplateElementsForSlot,
  serializeProjectSignature,
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
  const [, setIssues] = useState<ValidateIssue[]>([]);
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
  const {
    updateDoc,
    togglePlatform,
    toggleDevicePreset,
    moveSlot,
    addSlot,
    removeSlot,
    upsertLlmConfig,
    renameSlot,
    openSlotImagePicker
  } = useProjectSlotActions({
    setDoc,
    setSelectedSlot,
    slotImageInputRef,
    slotImageTargetRef,
    startSlotTransition
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

  const { handleRunLocalization } = usePipelineActions({
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

  const {
    slots,
    selectedSlotData,
    selectedSlotBackground,
    slotCanvasCardSize,
    slotCanvasPositions,
    screenCanvasSlots,
    commitSelectedSlotName,
    handleSelectSlot,
    reorderSlotByDrag,
    updateCopyByKey,
    handleSelectedTitleChange,
    handleSelectedSubtitleChange,
    renderPreviewSlotCard
  } = useScreenWorkflowState({
    doc,
    selectedSlot,
    selectedLocale,
    selectedSlotNameDraft,
    selectedDeviceSpec,
    deferredTemplateMain,
    slotPreviewUrls,
    slotSourceUrls,
    previewMatrixUrls,
    templateImageUrls,
    setDoc,
    setSelectedSlot,
    setSelectedLocale,
    setSelectedSlotNameDraft,
    startSlotTransition,
    renameSlot,
    updateDoc
  });
  const previewPath = previewMatrixPaths[selectedLocale]?.[selectedSlot] || slotPreviewPaths[selectedSlot] || '';
  const onboardingReady = doc.project.locales.length > 0
    && doc.project.platforms.length > 0
    && doc.project.devices.length > 0;
  const { handleOpenOnboarding, handleCompleteOnboarding } = useOnboardingActions({
    onboardingReady,
    locales: doc.project.locales,
    devices: doc.project.devices,
    onboardingStorageKey: ONBOARDING_STORAGE_KEY,
    setSelectedLocale,
    setSelectedDevice,
    setIsOnboardingOpen
  });

  useEffect(() => {
    if (activeStep !== 'preview' || !isTauriRuntime()) {
      return;
    }

    void loadPreviewMatrix();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, previewMatrixLoadKey]);

  const {
    selectedTemplateSlotId,
    updateTemplateBackground,
    updateTemplateElement,
    moveTemplateElement,
    addTemplateElement,
    removeTemplateElement,
    openTemplateImagePicker
  } = useTemplateEditorActions({
    setDoc,
    startTemplateTransition,
    selectedSlot,
    selectedSlotDataId: selectedSlotData?.id,
    selectedDeviceWidth: selectedDeviceSpec.width,
    availableFonts,
    templateImageInputRef,
    templateImageTargetRef,
    setSelectedTemplateElementId
  });

  const { handleSlotImageFileChange, handleTemplateImageFileChange } = useProjectImageUploadHandlers({
    runWithBusy,
    updateDoc,
    updateTemplateElement,
    setSlotSourceUrls,
    setTemplateImageUrls,
    slotImageTargetRef,
    templateImageTargetRef,
    selectedTemplateSlotId
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
