import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from 'react';

import { browserFileToBase64, isTauriRuntime, writeFileBase64 } from '../lib/desktop-runtime';
import {
  imageMimeTypeFromPath,
  slotTemplateImageKey,
  type ProjectDoc,
  type TemplateElement
} from '../lib/project-model';
import type { BusyHelpers, BusyRunOptions } from './useBusyRunner';

interface UseProjectImageUploadHandlersArgs {
  runWithBusy: (action: (helpers: BusyHelpers) => Promise<void>, options?: BusyRunOptions) => Promise<void>;
  updateDoc: (mutator: (next: ProjectDoc) => void) => void;
  updateTemplateElement: (elementId: string, mutator: (element: TemplateElement) => TemplateElement) => void;
  setSlotSourceUrls: Dispatch<SetStateAction<Record<string, string>>>;
  setTemplateImageUrls: Dispatch<SetStateAction<Record<string, string>>>;
  slotImageTargetRef: MutableRefObject<string | null>;
  templateImageTargetRef: MutableRefObject<string | null>;
  selectedTemplateSlotId: string;
}

function buildUploadOutputPath(id: string, fileName: string): string {
  const extension = fileName.includes('.')
    ? (fileName.split('.').pop() || 'png').toLowerCase()
    : 'png';
  const normalizedExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
  return `examples/assets/source/uploads/${id}-${Date.now()}.${normalizedExtension}`;
}

export function useProjectImageUploadHandlers({
  runWithBusy,
  updateDoc,
  updateTemplateElement,
  setSlotSourceUrls,
  setTemplateImageUrls,
  slotImageTargetRef,
  templateImageTargetRef,
  selectedTemplateSlotId
}: UseProjectImageUploadHandlersArgs) {
  const handleSlotImageFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const slotId = slotImageTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!slotId || !file) {
      slotImageTargetRef.current = null;
      return;
    }

    const outputPath = buildUploadOutputPath(slotId, file.name);

    try {
      await runWithBusy(async () => {
        const base64 = await browserFileToBase64(file);
        const mime = imageMimeTypeFromPath(file.name);
        const canWriteToDisk = isTauriRuntime();
        if (canWriteToDisk) {
          await writeFileBase64(outputPath, base64);
        }

        const sourcePath = canWriteToDisk ? outputPath : file.name;
        updateDoc((next) => {
          const target = next.project.slots.find((slot) => slot.id === slotId);
          if (!target) return;
          target.sourceImagePath = sourcePath;
        });

        setSlotSourceUrls((current) => ({
          ...current,
          [slotId]: `data:${mime};base64,${base64}`
        }));
      }, {
        action: 'upload-slot-image',
        title: 'Uploading Slot Image',
        detail: 'Saving selected slot image...'
      });
    } catch {
      // Keep file picker UX resilient if writing image fails.
    } finally {
      slotImageTargetRef.current = null;
    }
  }, [runWithBusy, setSlotSourceUrls, slotImageTargetRef, updateDoc]);

  const handleTemplateImageFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const elementId = templateImageTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!elementId || !file) {
      templateImageTargetRef.current = null;
      return;
    }

    const outputPath = buildUploadOutputPath(elementId, file.name);

    try {
      await runWithBusy(async () => {
        const base64 = await browserFileToBase64(file);
        const mime = imageMimeTypeFromPath(file.name);
        await writeFileBase64(outputPath, base64);

        updateTemplateElement(elementId, (current) => (
          current.kind === 'image'
            ? {
              ...current,
              source: 'image',
              imagePath: outputPath
            }
            : current
        ));

        setTemplateImageUrls((current) => ({
          ...current,
          [slotTemplateImageKey(selectedTemplateSlotId, elementId)]: `data:${mime};base64,${base64}`
        }));
      }, {
        action: 'upload-template-image',
        title: 'Uploading Image',
        detail: 'Saving template image asset...'
      });
    } catch {
      // Keep file picker UX resilient if writing image fails.
    } finally {
      templateImageTargetRef.current = null;
    }
  }, [runWithBusy, selectedTemplateSlotId, setTemplateImageUrls, templateImageTargetRef, updateTemplateElement]);

  return {
    handleSlotImageFileChange,
    handleTemplateImageFileChange
  };
}
