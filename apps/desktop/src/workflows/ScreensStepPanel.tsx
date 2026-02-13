import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { InfiniteSlotCanvas, type CanvasSlotItem } from '../components/canvas/InfiniteSlotCanvas';
import { SelectedScreenInspector } from '../components/inspector/SelectedScreenInspector';
import { type SelectOption } from '../types/ui';
import { type Device, type Slot, type SlotCanvasPosition } from '../lib/project-model';
import { ScreensWorkflowPage } from './ScreensWorkflowPage';

interface ScreensStepPanelProps {
  screenFocusTrigger: number;
  screenCanvasSlots: CanvasSlotItem[];
  slotCanvasPositions: Record<string, SlotCanvasPosition>;
  slotCanvasCardSize: { width: number; height: number };
  selectedSlot: string;
  templateImageUrls: Record<string, string>;
  selectedDeviceSpec: Device;
  onSelectSlot: (slotId: string) => void;
  onReorderSlotByDrag: (slotId: string, targetIndex: number) => void;
  onRenameSlot: (slotId: string, nextName: string) => void;
  selectedTemplateElementId: string;
  onSelectTemplateElement: Dispatch<SetStateAction<string>>;
  onMoveTemplateElement: (elementId: string, x: number, y: number) => void;
  selectedSlotData: Slot | null;
  selectedLocale: string;
  selectedSlotNameDraft: string;
  selectedSlotTitleValue: string;
  selectedSlotSubtitleValue: string;
  isMoveUpDisabled: boolean;
  isMoveDownDisabled: boolean;
  templateInspectorNode: ReactNode;
  onSlotNameDraftChange: Dispatch<SetStateAction<string>>;
  onCommitSlotName: () => void;
  onResetSlotNameDraft: () => void;
  onOpenSlotImagePicker: (slotId: string) => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onMoveSlotUp: () => void;
  onMoveSlotDown: () => void;
  onRemoveSlot: () => void;
  isXlLayout: boolean;
  selectedDevice: string;
  slots: Slot[];
  deviceOptions: SelectOption[];
  slotOptions: SelectOption[];
  onSelectDevice: Dispatch<SetStateAction<string>>;
  onAddSlot: () => void;
}

export function ScreensStepPanel({
  screenFocusTrigger,
  screenCanvasSlots,
  slotCanvasPositions,
  slotCanvasCardSize,
  selectedSlot,
  templateImageUrls,
  selectedDeviceSpec,
  onSelectSlot,
  onReorderSlotByDrag,
  onRenameSlot,
  selectedTemplateElementId,
  onSelectTemplateElement,
  onMoveTemplateElement,
  selectedSlotData,
  selectedLocale,
  selectedSlotNameDraft,
  selectedSlotTitleValue,
  selectedSlotSubtitleValue,
  isMoveUpDisabled,
  isMoveDownDisabled,
  templateInspectorNode,
  onSlotNameDraftChange,
  onCommitSlotName,
  onResetSlotNameDraft,
  onOpenSlotImagePicker,
  onTitleChange,
  onSubtitleChange,
  onMoveSlotUp,
  onMoveSlotDown,
  onRemoveSlot,
  isXlLayout,
  selectedDevice,
  slots,
  deviceOptions,
  slotOptions,
  onSelectDevice,
  onAddSlot
}: ScreensStepPanelProps) {
  return (
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
          onSelect={onSelectSlot}
          onReorder={onReorderSlotByDrag}
          onRename={onRenameSlot}
          selectedTemplateElementId={selectedTemplateElementId}
          onSelectTemplateElement={onSelectTemplateElement}
          onMoveTemplateElement={onMoveTemplateElement}
        />
      )}
      inspectorNode={(
        <SelectedScreenInspector
          selectedSlotData={selectedSlotData}
          selectedLocale={selectedLocale}
          selectedSlotNameDraft={selectedSlotNameDraft}
          titleValue={selectedSlotTitleValue}
          subtitleValue={selectedSlotSubtitleValue}
          isMoveUpDisabled={isMoveUpDisabled}
          isMoveDownDisabled={isMoveDownDisabled}
          templateInspectorNode={templateInspectorNode}
          onSlotNameDraftChange={onSlotNameDraftChange}
          onCommitSlotName={onCommitSlotName}
          onResetSlotNameDraft={onResetSlotNameDraft}
          onOpenSlotImagePicker={onOpenSlotImagePicker}
          onTitleChange={onTitleChange}
          onSubtitleChange={onSubtitleChange}
          onMoveSlotUp={onMoveSlotUp}
          onMoveSlotDown={onMoveSlotDown}
          onRemoveSlot={onRemoveSlot}
        />
      )}
      isXlLayout={isXlLayout}
      selectedDevice={selectedDevice}
      selectedSlot={selectedSlot}
      slotCount={slots.length}
      deviceOptions={deviceOptions}
      slotOptions={slotOptions}
      onSelectDevice={onSelectDevice}
      onSelectSlot={onSelectSlot}
      onAddSlot={onAddSlot}
    />
  );
}
