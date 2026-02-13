import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { ExportStepPanel } from './workflows/ExportStepPanel';
import { LocalizationStepPanel } from './workflows/LocalizationStepPanel';
import { PreviewStepPanel } from './workflows/PreviewStepPanel';
import { ScreensStepPanel } from './workflows/ScreensStepPanel';
import { TemplateInspectorSection } from './components/inspector/TemplateInspectorSection';
import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay';
import { BusyOverlay } from './components/overlay/BusyOverlay';
import { WorkflowSidebar } from './components/sidebar/WorkflowSidebar';
import { useProjectImageAssets } from './hooks/useProjectImageAssets';
import { useProjectBootstrapPaths } from './hooks/useProjectBootstrapPaths';
import { useBusyRunner } from './hooks/useBusyRunner';
import { useDesktopEnvironment } from './hooks/useDesktopEnvironment';
import { useExportAction } from './hooks/useExportAction';
import { useProjectFileActions } from './hooks/useProjectFileActions';
import { useProjectImageUploadHandlers } from './hooks/useProjectImageUploadHandlers';
import { usePersistProjectSnapshot } from './hooks/usePersistProjectSnapshot';
import { usePipelineActions } from './hooks/usePipelineActions';
import { useOnboardingActions } from './hooks/useOnboardingActions';
import { useProjectSelectionSync } from './hooks/useProjectSelectionSync';
import { useProjectSlotActions } from './hooks/useProjectSlotActions';
import { useProjectWorkflowActions } from './hooks/useProjectWorkflowActions';
import { useWorkflowNavigation } from './hooks/useWorkflowNavigation';
import { usePreviewLoaders } from './hooks/usePreviewLoaders';
import { useScreenWorkflowState } from './hooks/useScreenWorkflowState';
import { useTemplateEditorActions } from './hooks/useTemplateEditorActions';
import { useWorkflowStepOptions } from './hooks/useWorkflowStepOptions';
import { resolveOutputDir as resolveOutputDirPath } from './lib/output-dir';
import {
  isTauriRuntime,
  pickOutputDir
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
const PREVIEW_RENDER_DIR = 'dist-render';

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
  const [, setIssues] = useState<ValidateIssue[]>([]);
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1';
  });
  const { isXlLayout, availableFonts } = useDesktopEnvironment({
    mediaQuery: XL_MEDIA_QUERY,
    fallbackFonts: defaultSystemFonts
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
  const {
    handleLocalizationLocalesChange,
    handleSourceLocaleChange,
    handleLlmCommandChange,
    handleLlmTimeoutSecChange,
    handleLlmPromptChange,
    handleZipEnabledChange,
    handleMetadataCsvEnabledChange,
    handleOnboardingLocalesChange
  } = useProjectWorkflowActions({
    updateDoc,
    upsertLlmConfig
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

  const { activeStepIndex, isFirstStep, isLastStep, goPrevStep, goNextStep } = useWorkflowNavigation({
    steps,
    activeStep,
    setActiveStep
  });

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
    previewRenderDir: PREVIEW_RENDER_DIR,
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
      PREVIEW_RENDER_DIR,
      selectedPlatform,
      selectedDevice,
      doc.project.locales.join(','),
      doc.project.slots.map((slot) => slot.id).join(',')
    ].join('|'),
    [doc.project.locales, doc.project.slots, selectedDevice, selectedPlatform]
  );

  useEffect(() => {
    if (activeStep !== 'screens') return;
    setScreenFocusTrigger((current) => current + 1);
  }, [activeStep]);

  useProjectSelectionSync({
    locales: doc.project.locales,
    devices: doc.project.devices,
    slots: doc.project.slots,
    selectedLocale,
    selectedDevice,
    selectedSlot,
    setSelectedLocale,
    setSelectedDevice,
    setSelectedSlot,
    templateElements,
    selectedTemplateElementId,
    setSelectedTemplateElementId
  });

  useEffect(() => {
    if (!isProjectBaselineReady || savedProjectSignature !== null) {
      return;
    }
    setSavedProjectSignature(currentProjectSignature);
  }, [currentProjectSignature, isProjectBaselineReady, savedProjectSignature]);

  const persistProjectSnapshot = usePersistProjectSnapshot({
    doc,
    outputDir,
    projectPath,
    selectedDeviceWidth: selectedDeviceSpec.width,
    resolveOutputDir,
    setSavedProjectSignature
  });
  const handleExport = useExportAction({
    doc,
    outputDir,
    previewRenderDir: PREVIEW_RENDER_DIR,
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
    previewRenderDir: PREVIEW_RENDER_DIR,
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
  const handleSaveProjectClick = useCallback(() => {
    void handleSaveProject();
  }, [handleSaveProject]);

  const {
    slots,
    selectedSlotData,
    selectedSlotBackground,
    slotCanvasCardSize,
    slotCanvasPositions,
    isMoveUpDisabled,
    isMoveDownDisabled,
    screenCanvasSlots,
    commitSelectedSlotName,
    resetSelectedSlotNameDraft,
    moveSelectedSlotUp,
    moveSelectedSlotDown,
    removeSelectedSlot,
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
    moveSlot,
    removeSlot,
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
  const {
    deviceOptions,
    slotOptions,
    localeOptions: previewLocaleOptions,
    selectedSlotTitleValue,
    selectedSlotSubtitleValue
  } = useWorkflowStepOptions({
    devices: doc.project.devices,
    locales: doc.project.locales,
    slots,
    selectedSlotData,
    selectedLocale,
    copyKeys: doc.copy.keys
  });

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
          onSave={handleSaveProjectClick}
          onNew={handleCreateNewProject}
          onSetup={handleOpenOnboarding}
          onPrev={goPrevStep}
          onNext={goNextStep}
        />

        <div className={activeStep === 'screens' ? 'space-y-4' : 'space-y-4 pt-2 lg:pl-[250px]'}>
          {activeStep === 'screens' ? (
            <ScreensStepPanel
              screenFocusTrigger={screenFocusTrigger}
              screenCanvasSlots={screenCanvasSlots}
              slotCanvasPositions={slotCanvasPositions}
              slotCanvasCardSize={slotCanvasCardSize}
              selectedSlot={selectedSlot}
              templateImageUrls={templateImageUrls}
              selectedDeviceSpec={selectedDeviceSpec}
              onSelectSlot={handleSelectSlot}
              onReorderSlotByDrag={reorderSlotByDrag}
              onRenameSlot={renameSlot}
              selectedTemplateElementId={selectedTemplateElementId}
              onSelectTemplateElement={setSelectedTemplateElementId}
              onMoveTemplateElement={moveTemplateElement}
              selectedSlotData={selectedSlotData}
              selectedLocale={selectedLocale}
              selectedSlotNameDraft={selectedSlotNameDraft}
              selectedSlotTitleValue={selectedSlotTitleValue}
              selectedSlotSubtitleValue={selectedSlotSubtitleValue}
              isMoveUpDisabled={isMoveUpDisabled}
              isMoveDownDisabled={isMoveDownDisabled}
              templateInspectorNode={templateInspectorSection}
              onSlotNameDraftChange={setSelectedSlotNameDraft}
              onCommitSlotName={commitSelectedSlotName}
              onResetSlotNameDraft={resetSelectedSlotNameDraft}
              onOpenSlotImagePicker={openSlotImagePicker}
              onTitleChange={handleSelectedTitleChange}
              onSubtitleChange={handleSelectedSubtitleChange}
              onMoveSlotUp={moveSelectedSlotUp}
              onMoveSlotDown={moveSelectedSlotDown}
              onRemoveSlot={removeSelectedSlot}
              isXlLayout={isXlLayout}
              selectedDevice={selectedDevice}
              slots={slots}
              deviceOptions={deviceOptions}
              slotOptions={slotOptions}
              onSelectDevice={setSelectedDevice}
              onAddSlot={addSlot}
            />
          ) : null}

          {activeStep === 'localization' ? (
            <LocalizationStepPanel
              sourceLocale={doc.pipelines.localization.sourceLocale || doc.project.locales[0] || 'en-US'}
              isBusy={isBusy}
              localizationBusyLabel={isBusy ? busyDetail : ''}
              llmConfig={llmConfig}
              slots={slots}
              locales={doc.project.locales}
              localeOptions={localePresets}
              onLocalizationLocalesChange={handleLocalizationLocalesChange}
              onSourceLocaleChange={handleSourceLocaleChange}
              onRunLocalization={handleRunLocalization}
              onLlmCommandChange={handleLlmCommandChange}
              onLlmTimeoutSecChange={handleLlmTimeoutSecChange}
              onLlmPromptChange={handleLlmPromptChange}
              getCopyValue={(key, locale) => doc.copy.keys[key]?.[locale] || ''}
              onCopyChange={updateCopyByKey}
            />
          ) : null}

          {activeStep === 'preview' ? (
            <PreviewStepPanel
              deviceOptions={deviceOptions}
              selectedDevice={selectedDevice}
              onSelectDevice={setSelectedDevice}
              localeOptions={previewLocaleOptions}
              slotOptions={slotOptions}
              previewPath={previewPath}
              renderSlotPreviewCard={renderPreviewSlotCard}
            />
          ) : null}

          {activeStep === 'export' ? (
            <ExportStepPanel
              outputDir={outputDir}
              zipEnabled={doc.pipelines.export.zip}
              metadataCsvEnabled={doc.pipelines.export.metadataCsv}
              isBusy={isBusy}
              exportStatus={exportStatus}
              exportError={exportError}
              onOutputDirChange={setOutputDir}
              onPickOutputDir={handlePickOutputDir}
              canPickOutputDir={isTauriRuntime()}
              onZipEnabledChange={handleZipEnabledChange}
              onMetadataCsvEnabledChange={handleMetadataCsvEnabledChange}
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
        onLocalesChange={handleOnboardingLocalesChange}
        onPlatformToggle={togglePlatform}
        onDeviceToggle={toggleDevicePreset}
        onStart={handleCompleteOnboarding}
      />
    </div>
  );
}
