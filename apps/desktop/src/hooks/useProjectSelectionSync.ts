import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { type Device, type Slot, type TemplateElement } from '../lib/project-model';

interface UseProjectSelectionSyncParams {
  locales: string[];
  devices: Device[];
  slots: Slot[];
  selectedLocale: string;
  selectedDevice: string;
  selectedSlot: string;
  setSelectedLocale: Dispatch<SetStateAction<string>>;
  setSelectedDevice: Dispatch<SetStateAction<string>>;
  setSelectedSlot: Dispatch<SetStateAction<string>>;
  templateElements: TemplateElement[];
  selectedTemplateElementId: string;
  setSelectedTemplateElementId: Dispatch<SetStateAction<string>>;
}

export function useProjectSelectionSync({
  locales,
  devices,
  slots,
  selectedLocale,
  selectedDevice,
  selectedSlot,
  setSelectedLocale,
  setSelectedDevice,
  setSelectedSlot,
  templateElements,
  selectedTemplateElementId,
  setSelectedTemplateElementId
}: UseProjectSelectionSyncParams) {
  useEffect(() => {
    if (!locales.includes(selectedLocale)) {
      setSelectedLocale(locales[0] || 'en-US');
    }

    if (!devices.some((device) => device.id === selectedDevice)) {
      setSelectedDevice(devices[0]?.id || 'ios_phone');
    }

    if (!slots.some((slot) => slot.id === selectedSlot)) {
      setSelectedSlot(slots[0]?.id || 'slot1');
    }
  }, [devices, locales, selectedDevice, selectedLocale, selectedSlot, setSelectedDevice, setSelectedLocale, setSelectedSlot, slots]);

  useEffect(() => {
    if (templateElements.length === 0) {
      setSelectedTemplateElementId('');
      return;
    }

    if (!templateElements.some((item) => item.id === selectedTemplateElementId)) {
      setSelectedTemplateElementId(templateElements[0].id);
    }
  }, [selectedTemplateElementId, setSelectedTemplateElementId, templateElements]);
}
