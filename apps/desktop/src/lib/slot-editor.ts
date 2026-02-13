import {
  type Device,
  type Platform,
  type StoreShotDoc,
  clone,
  cloneTemplateElements,
  detectPlatformFromDeviceId,
  fieldKey,
  reorderSlots,
  resolveNextSlotIdentity,
  resolveTemplateElementsForSlot,
  sortSlotsByOrder
} from './project-model';

export function applyTogglePlatform(next: StoreShotDoc, platform: Platform, checked: boolean) {
  const current = new Set(next.project.platforms);
  if (checked) {
    current.add(platform);
  } else {
    current.delete(platform);
  }

  next.project.platforms = Array.from(current) as Platform[];
  next.project.devices = next.project.devices.filter((device) => {
    const detected = device.platform || detectPlatformFromDeviceId(device.id);
    return next.project.platforms.includes(detected);
  });
}

export function applyToggleDevicePreset(next: StoreShotDoc, presetDevice: Device, checked: boolean) {
  const exists = next.project.devices.some((device) => device.id === presetDevice.id);
  if (checked && !exists) {
    next.project.devices.push(clone(presetDevice));
  }

  if (!checked) {
    next.project.devices = next.project.devices.filter((device) => device.id !== presetDevice.id);
  }
}

export function applyMoveSlot(next: StoreShotDoc, slotId: string, direction: -1 | 1) {
  const ordered = sortSlotsByOrder(next.project.slots);
  const index = ordered.findIndex((slot) => slot.id === slotId);
  if (index < 0) {
    return;
  }

  const target = index + direction;
  if (target < 0 || target >= ordered.length) {
    return;
  }

  const [picked] = ordered.splice(index, 1);
  ordered.splice(target, 0, picked);
  next.project.slots = reorderSlots(ordered);
}

export function applyAddSlot(next: StoreShotDoc): string {
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

  return newSlot.id;
}

export function applyRemoveSlot(next: StoreShotDoc, slotId: string) {
  next.project.slots = reorderSlots(next.project.slots.filter((slot) => slot.id !== slotId));
  delete next.copy.keys[fieldKey(slotId, 'title')];
  delete next.copy.keys[fieldKey(slotId, 'subtitle')];
  delete next.template.main.slotBackgrounds[slotId];
  delete next.template.main.slotElements[slotId];
}
