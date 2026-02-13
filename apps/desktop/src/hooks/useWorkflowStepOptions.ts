import { useMemo } from 'react';

import { fieldKey, type Device, type Slot, type StoreShotDoc } from '../lib/project-model';
import { type SelectOption } from '../types/ui';

interface UseWorkflowStepOptionsParams {
  devices: Device[];
  locales: string[];
  slots: Slot[];
  selectedSlotData: Slot | null;
  selectedLocale: string;
  copyKeys: StoreShotDoc['copy']['keys'];
}

interface UseWorkflowStepOptionsResult {
  deviceOptions: SelectOption[];
  slotOptions: SelectOption[];
  localeOptions: SelectOption[];
  selectedSlotTitleValue: string;
  selectedSlotSubtitleValue: string;
}

export function useWorkflowStepOptions({
  devices,
  locales,
  slots,
  selectedSlotData,
  selectedLocale,
  copyKeys
}: UseWorkflowStepOptionsParams): UseWorkflowStepOptionsResult {
  const deviceOptions = useMemo(
    () => devices.map((device) => ({ value: device.id, label: device.id })),
    [devices]
  );
  const slotOptions = useMemo(
    () => slots.map((slot) => ({ value: slot.id, label: slot.name })),
    [slots]
  );
  const localeOptions = useMemo(
    () => locales.map((locale) => ({ value: locale, label: locale })),
    [locales]
  );
  const selectedSlotTitleValue = useMemo(() => {
    if (!selectedSlotData) return '';
    return copyKeys[fieldKey(selectedSlotData.id, 'title')]?.[selectedLocale] || '';
  }, [copyKeys, selectedLocale, selectedSlotData]);
  const selectedSlotSubtitleValue = useMemo(() => {
    if (!selectedSlotData) return '';
    return copyKeys[fieldKey(selectedSlotData.id, 'subtitle')]?.[selectedLocale] || '';
  }, [copyKeys, selectedLocale, selectedSlotData]);

  return {
    deviceOptions,
    slotOptions,
    localeOptions,
    selectedSlotTitleValue,
    selectedSlotSubtitleValue
  };
}
