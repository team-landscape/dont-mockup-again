import { listPngFiles, readFileBase64 } from './desktop-runtime';
import { sortSlotsByOrder, type Slot } from './project-model';

interface LoadSlotPreviewMapArgs {
  slots: Slot[];
  previewRenderDir: string;
  selectedPlatform: string;
  selectedDevice: string;
  selectedLocale: string;
  selectedSlot: string;
}

interface LoadPreviewMatrixArgs {
  slots: Slot[];
  locales: string[];
  previewRenderDir: string;
  selectedPlatform: string;
  selectedDevice: string;
}

export async function loadSlotPreviewMapFromDir({
  slots,
  previewRenderDir,
  selectedPlatform,
  selectedDevice,
  selectedLocale,
  selectedSlot
}: LoadSlotPreviewMapArgs) {
  const sortedSlots = sortSlotsByOrder(slots);
  const files = await listPngFiles(previewRenderDir);
  const urls: Record<string, string> = {};
  const paths: Record<string, string> = {};

  for (const slot of sortedSlots) {
    const suffix = `${selectedPlatform}/${selectedDevice}/${selectedLocale}/${slot.id}.png`;
    const picked = files.find((entry) => entry.endsWith(suffix));
    if (!picked) continue;

    const base64 = await readFileBase64(picked);
    urls[slot.id] = `data:image/png;base64,${base64}`;
    paths[slot.id] = picked;
  }

  return {
    urls,
    paths,
    loaded: Object.keys(paths).length,
    total: sortedSlots.length,
    selectedPath: paths[selectedSlot] || ''
  };
}

export async function loadPreviewMatrixFromDir({
  slots,
  locales,
  previewRenderDir,
  selectedPlatform,
  selectedDevice
}: LoadPreviewMatrixArgs) {
  const sortedSlots = sortSlotsByOrder(slots);
  const files = await listPngFiles(previewRenderDir);
  const urlsByLocale: Record<string, Record<string, string>> = {};
  const pathsByLocale: Record<string, Record<string, string>> = {};

  for (const locale of locales) {
    urlsByLocale[locale] = {};
    pathsByLocale[locale] = {};

    for (const slot of sortedSlots) {
      const suffix = `${selectedPlatform}/${selectedDevice}/${locale}/${slot.id}.png`;
      const picked = files.find((entry) => entry.endsWith(suffix));
      if (!picked) continue;

      const base64 = await readFileBase64(picked);
      urlsByLocale[locale][slot.id] = `data:image/png;base64,${base64}`;
      pathsByLocale[locale][slot.id] = picked;
    }
  }

  return {
    urlsByLocale,
    pathsByLocale
  };
}
