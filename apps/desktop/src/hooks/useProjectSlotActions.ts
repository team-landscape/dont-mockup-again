import { useCallback, type MutableRefObject, type TransitionStartFunction } from 'react';

import {
  applyAddSlot,
  applyMoveSlot,
  applyRemoveSlot,
  applyToggleDevicePreset,
  applyTogglePlatform
} from '../lib/slot-editor';
import {
  type Device,
  type LlmCliConfig,
  type Platform,
  type ProjectDoc,
  clone,
  defaultLlmConfig
} from '../lib/project-model';

interface UseProjectSlotActionsArgs {
  setDoc: (value: ProjectDoc | ((current: ProjectDoc) => ProjectDoc)) => void;
  setSelectedSlot: (value: string) => void;
  slotImageInputRef: MutableRefObject<HTMLInputElement | null>;
  slotImageTargetRef: MutableRefObject<string | null>;
  startSlotTransition: TransitionStartFunction;
}

export function useProjectSlotActions({
  setDoc,
  setSelectedSlot,
  slotImageInputRef,
  slotImageTargetRef,
  startSlotTransition
}: UseProjectSlotActionsArgs) {
  const updateDoc = useCallback((mutator: (next: ProjectDoc) => void) => {
    setDoc((current) => {
      const next = clone(current);
      mutator(next);
      return next;
    });
  }, [setDoc]);

  const togglePlatform = useCallback((platform: Platform, checked: boolean) => {
    updateDoc((next) => {
      applyTogglePlatform(next, platform, checked);
    });
  }, [updateDoc]);

  const toggleDevicePreset = useCallback((presetDevice: Device, checked: boolean) => {
    updateDoc((next) => {
      applyToggleDevicePreset(next, presetDevice, checked);
    });
  }, [updateDoc]);

  const moveSlot = useCallback((slotId: string, direction: -1 | 1) => {
    updateDoc((next) => {
      applyMoveSlot(next, slotId, direction);
    });
  }, [updateDoc]);

  const openSlotImagePicker = useCallback((slotId: string) => {
    slotImageTargetRef.current = slotId;
    slotImageInputRef.current?.click();
  }, [slotImageInputRef, slotImageTargetRef]);

  const addSlot = useCallback(() => {
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
  }, [openSlotImagePicker, setSelectedSlot, startSlotTransition, updateDoc]);

  const removeSlot = useCallback((slotId: string) => {
    updateDoc((next) => {
      applyRemoveSlot(next, slotId);
    });
  }, [updateDoc]);

  const upsertLlmConfig = useCallback((mutator: (cfg: LlmCliConfig) => void) => {
    updateDoc((next) => {
      next.pipelines.localization.llmCli = next.pipelines.localization.llmCli || clone(defaultLlmConfig);
      mutator(next.pipelines.localization.llmCli);
    });
  }, [updateDoc]);

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
  }, [setDoc]);

  return {
    updateDoc,
    togglePlatform,
    toggleDevicePreset,
    moveSlot,
    addSlot,
    removeSlot,
    upsertLlmConfig,
    renameSlot,
    openSlotImagePicker
  };
}
