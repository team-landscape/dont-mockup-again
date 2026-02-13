import { useCallback } from 'react';

import { loadPreviewMatrixFromDir, loadSlotPreviewMapFromDir } from '../lib/preview-file-loaders';
import type { Slot } from '../lib/project-model';

interface UsePreviewLoadersArgs {
  slots: Slot[];
  locales: string[];
  previewRenderDir: string;
  selectedPlatform: string;
  selectedDevice: string;
  selectedLocale: string;
  selectedSlot: string;
  setSlotPreviewUrls: (value: Record<string, string>) => void;
  setSlotPreviewPaths: (value: Record<string, string>) => void;
  setPreviewMatrixUrls: (value: Record<string, Record<string, string>>) => void;
  setPreviewMatrixPaths: (value: Record<string, Record<string, string>>) => void;
}

export function usePreviewLoaders({
  slots,
  locales,
  previewRenderDir,
  selectedPlatform,
  selectedDevice,
  selectedLocale,
  selectedSlot,
  setSlotPreviewUrls,
  setSlotPreviewPaths,
  setPreviewMatrixUrls,
  setPreviewMatrixPaths
}: UsePreviewLoadersArgs) {
  const loadSlotPreviewMap = useCallback(async () => {
    const result = await loadSlotPreviewMapFromDir({
      slots,
      previewRenderDir,
      selectedPlatform,
      selectedDevice,
      selectedLocale,
      selectedSlot
    });

    setSlotPreviewUrls(result.urls);
    setSlotPreviewPaths(result.paths);

    return {
      loaded: result.loaded,
      total: result.total,
      selectedPath: result.selectedPath
    };
  }, [
    previewRenderDir,
    selectedDevice,
    selectedLocale,
    selectedPlatform,
    selectedSlot,
    setSlotPreviewPaths,
    setSlotPreviewUrls,
    slots
  ]);

  const loadPreviewMatrix = useCallback(async () => {
    try {
      const result = await loadPreviewMatrixFromDir({
        slots,
        locales,
        previewRenderDir,
        selectedPlatform,
        selectedDevice
      });

      setPreviewMatrixUrls(result.urlsByLocale);
      setPreviewMatrixPaths(result.pathsByLocale);
      return result.urlsByLocale;
    } catch {
      setPreviewMatrixUrls({});
      setPreviewMatrixPaths({});
      return {};
    }
  }, [
    locales,
    previewRenderDir,
    selectedDevice,
    selectedPlatform,
    setPreviewMatrixPaths,
    setPreviewMatrixUrls,
    slots
  ]);

  return {
    loadSlotPreviewMap,
    loadPreviewMatrix
  };
}
