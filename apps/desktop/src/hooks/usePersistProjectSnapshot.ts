import { useCallback } from 'react';

import { writeTextFile } from '../lib/desktop-runtime';
import {
  type ProjectDoc,
  TEMPLATE_REFERENCE_WIDTH,
  buildProjectSnapshotForPersistence,
  serializeProjectSignature
} from '../lib/project-model';

interface UsePersistProjectSnapshotArgs {
  doc: ProjectDoc;
  outputDir: string;
  projectPath: string;
  selectedDeviceWidth: number;
  resolveOutputDir: (value: string | undefined) => string;
  setSavedProjectSignature: (value: string) => void;
}

export function usePersistProjectSnapshot({
  doc,
  outputDir,
  projectPath,
  selectedDeviceWidth,
  resolveOutputDir,
  setSavedProjectSignature
}: UsePersistProjectSnapshotArgs) {
  return useCallback(async (options?: { syncTemplateMain?: boolean }) => {
    if (!projectPath.trim()) {
      throw new Error('No project file selected. Save project first.');
    }

    const next = buildProjectSnapshotForPersistence(doc, resolveOutputDir(outputDir), {
      syncTemplateMain: options?.syncTemplateMain !== false,
      slotWidth: Math.max(1, selectedDeviceWidth || TEMPLATE_REFERENCE_WIDTH)
    });
    await writeTextFile(projectPath, JSON.stringify(next, null, 2));
    setSavedProjectSignature(serializeProjectSignature(next));
    return next;
  }, [
    doc,
    outputDir,
    projectPath,
    resolveOutputDir,
    selectedDeviceWidth,
    setSavedProjectSignature
  ]);
}
