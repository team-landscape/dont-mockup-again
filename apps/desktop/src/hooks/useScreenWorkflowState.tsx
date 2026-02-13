import {
  type Dispatch,
  type SetStateAction,
  type TransitionStartFunction,
  useCallback,
  useEffect,
  useMemo
} from 'react';

import { SlotRenderPreview } from '../components/preview/SlotPreview';
import { type CanvasSlotItem } from '../components/canvas/InfiniteSlotCanvas';
import {
  type Device,
  type SlotCanvasPosition,
  type StoreShotDoc,
  type TemplateBackground,
  type TemplateMain,
  defaultSlotCanvasPosition,
  fieldKey,
  getSlotCanvasCardSize,
  reorderSlots,
  resolveTemplateElementsForSlot,
  sortSlotsByOrder
} from '../lib/project-model';

interface UseScreenWorkflowStateArgs {
  doc: StoreShotDoc;
  selectedSlot: string;
  selectedLocale: string;
  selectedSlotNameDraft: string;
  selectedDeviceSpec: Device;
  deferredTemplateMain: TemplateMain;
  slotPreviewUrls: Record<string, string>;
  slotSourceUrls: Record<string, string>;
  previewMatrixUrls: Record<string, Record<string, string>>;
  templateImageUrls: Record<string, string>;
  setDoc: Dispatch<SetStateAction<StoreShotDoc>>;
  setSelectedSlot: Dispatch<SetStateAction<string>>;
  setSelectedLocale: Dispatch<SetStateAction<string>>;
  setSelectedSlotNameDraft: Dispatch<SetStateAction<string>>;
  startSlotTransition: TransitionStartFunction;
  renameSlot: (slotId: string, nextName: string) => void;
  updateDoc: (mutator: (next: StoreShotDoc) => void) => void;
}

export function useScreenWorkflowState({
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
}: UseScreenWorkflowStateArgs) {
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
  }, [selectedSlotData?.id, selectedSlotData?.name, setSelectedSlotNameDraft]);

  const commitSelectedSlotName = useCallback(() => {
    if (!selectedSlotData) return;

    const normalizedName = selectedSlotNameDraft.trim();
    if (!normalizedName) {
      setSelectedSlotNameDraft(selectedSlotData.name);
      return;
    }

    renameSlot(selectedSlotData.id, normalizedName);
    setSelectedSlotNameDraft(normalizedName);
  }, [renameSlot, selectedSlotData, selectedSlotNameDraft, setSelectedSlotNameDraft]);

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
  }, [slotCanvasCardSize.width, slots]);

  const handleSelectSlot = useCallback((slotId: string) => {
    startSlotTransition(() => {
      setSelectedSlot(slotId);
    });
  }, [setSelectedSlot, startSlotTransition]);

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
  }, [updateDoc]);

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
    deferredTemplateMain,
    doc.copy.keys,
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
  }, [setDoc]);

  const handleSelectedTitleChange = useCallback((value: string) => {
    if (!selectedTitleKey) return;
    updateCopyByKey(selectedTitleKey, selectedLocale, value);
  }, [selectedLocale, selectedTitleKey, updateCopyByKey]);

  const handleSelectedSubtitleChange = useCallback((value: string) => {
    if (!selectedSubtitleKey) return;
    updateCopyByKey(selectedSubtitleKey, selectedLocale, value);
  }, [selectedLocale, selectedSubtitleKey, updateCopyByKey]);

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
    setSelectedLocale,
    slotPreviewUrls,
    slotSourceUrls,
    templateImageUrls
  ]);

  return {
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
  };
}
