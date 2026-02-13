import { useEffect, useMemo, useState } from 'react';

import { isTauriRuntime, readFileBase64 } from '../lib/desktop-runtime';
import {
  globalTemplateImageKey,
  imageMimeTypeFromPath,
  slotTemplateImageKey,
  type Slot,
  type TemplateImageElement,
  type TemplateMain
} from '../lib/project-model';

interface UseProjectImageAssetsArgs {
  slots: Slot[];
  templateMain: TemplateMain;
}

export function useProjectImageAssets({ slots, templateMain }: UseProjectImageAssetsArgs) {
  const [slotSourceUrls, setSlotSourceUrls] = useState<Record<string, string>>({});
  const [templateImageUrls, setTemplateImageUrls] = useState<Record<string, string>>({});

  const slotSourceLoadKey = useMemo(() => {
    return slots.map((slot) => `${slot.id}:${slot.sourceImagePath}`).join('|');
  }, [slots]);

  const templateImageLoadKey = useMemo(() => {
    const signatures: string[] = [];

    for (const item of templateMain.elements) {
      if (item.kind !== 'image') continue;
      signatures.push(`*:${item.id}:${item.imagePath}`);
    }

    for (const [slotId, elements] of Object.entries(templateMain.slotElements)) {
      for (const item of elements) {
        if (item.kind !== 'image') continue;
        signatures.push(`${slotId}:${item.id}:${item.imagePath}`);
      }
    }

    signatures.sort();
    return signatures.join('|');
  }, [templateMain.elements, templateMain.slotElements]);

  useEffect(() => {
    let cancelled = false;

    async function loadSourceImages() {
      if (!isTauriRuntime()) {
        if (!cancelled) setSlotSourceUrls({});
        return;
      }

      const next: Record<string, string> = {};
      for (const slot of slots) {
        if (!slot.sourceImagePath) continue;

        try {
          const base64 = await readFileBase64(slot.sourceImagePath);
          const mime = imageMimeTypeFromPath(slot.sourceImagePath);
          next[slot.id] = `data:${mime};base64,${base64}`;
        } catch {
          // Missing source image is allowed while editing.
        }
      }

      if (!cancelled) {
        setSlotSourceUrls(next);
      }
    }

    void loadSourceImages();
    return () => {
      cancelled = true;
    };
  }, [slotSourceLoadKey, slots]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplateImages() {
      if (!isTauriRuntime()) {
        if (!cancelled) setTemplateImageUrls({});
        return;
      }

      const next: Record<string, string> = {};
      const imageElements = templateMain.elements.filter((item): item is TemplateImageElement => item.kind === 'image');
      for (const element of imageElements) {
        if (!element.imagePath) continue;

        try {
          const base64 = await readFileBase64(element.imagePath);
          const mime = imageMimeTypeFromPath(element.imagePath);
          next[globalTemplateImageKey(element.id)] = `data:${mime};base64,${base64}`;
        } catch {
          // Missing custom image is allowed while editing.
        }
      }

      for (const [slotId, elements] of Object.entries(templateMain.slotElements)) {
        const slotImageElements = elements.filter((item): item is TemplateImageElement => item.kind === 'image');
        for (const element of slotImageElements) {
          if (!element.imagePath) continue;

          try {
            const base64 = await readFileBase64(element.imagePath);
            const mime = imageMimeTypeFromPath(element.imagePath);
            next[slotTemplateImageKey(slotId, element.id)] = `data:${mime};base64,${base64}`;
          } catch {
            // Missing custom image is allowed while editing.
          }
        }
      }

      if (!cancelled) {
        setTemplateImageUrls(next);
      }
    }

    void loadTemplateImages();
    return () => {
      cancelled = true;
    };
  }, [templateImageLoadKey, templateMain.elements, templateMain.slotElements]);

  return {
    slotSourceUrls,
    setSlotSourceUrls,
    templateImageUrls,
    setTemplateImageUrls
  };
}
