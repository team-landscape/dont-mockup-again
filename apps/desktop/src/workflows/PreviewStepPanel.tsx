import type { ReactNode } from 'react';

import { PreviewWorkflowPage } from './PreviewWorkflowPage';
import { type SelectOption } from '../types/ui';

interface PreviewStepPanelProps {
  deviceOptions: SelectOption[];
  selectedDevice: string;
  onSelectDevice: (value: string) => void;
  localeOptions: SelectOption[];
  slotOptions: SelectOption[];
  previewPath: string;
  renderSlotPreviewCard: (params: { locale: string; slotId: string; slotLabel: string }) => ReactNode;
}

export function PreviewStepPanel({
  deviceOptions,
  selectedDevice,
  onSelectDevice,
  localeOptions,
  slotOptions,
  previewPath,
  renderSlotPreviewCard
}: PreviewStepPanelProps) {
  return (
    <PreviewWorkflowPage
      deviceOptions={deviceOptions}
      selectedDevice={selectedDevice}
      onSelectDevice={onSelectDevice}
      localeOptions={localeOptions}
      slotOptions={slotOptions}
      previewPath={previewPath}
      renderSlotPreviewCard={renderSlotPreviewCard}
    />
  );
}
