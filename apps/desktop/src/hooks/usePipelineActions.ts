import { useCallback } from 'react';

import { readTextFile, runPipeline } from '../lib/desktop-runtime';
import { parseJsonOrNull } from '../lib/json-utils';
import { normalizeProject, type StoreShotDoc } from '../lib/project-model';
import type { BusyHelpers, BusyRunOptions } from './useBusyRunner';

interface ValidateIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

interface UsePipelineActionsArgs {
  projectPath: string;
  previewRenderDir: string;
  runWithBusy: (action: (helpers: BusyHelpers) => Promise<void>, options?: BusyRunOptions) => Promise<void>;
  persistProjectSnapshot: (options?: { syncTemplateMain?: boolean }) => Promise<StoreShotDoc>;
  loadSlotPreviewMap: () => Promise<{
    loaded: number;
    total: number;
    selectedPath: string;
  }>;
  loadPreviewMatrix: () => Promise<Record<string, Record<string, string>>>;
  setDoc: (value: StoreShotDoc) => void;
  setIssues: (value: ValidateIssue[]) => void;
}

export function usePipelineActions({
  projectPath,
  previewRenderDir,
  runWithBusy,
  persistProjectSnapshot,
  loadSlotPreviewMap,
  loadPreviewMatrix,
  setDoc,
  setIssues
}: UsePipelineActionsArgs) {
  const handleRunLocalization = useCallback(async () => {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();

      setDetail('Running localization pipeline...');
      await runPipeline('localize', [projectPath, '--write']);

      setDetail('Reloading localized copy...');
      const text = await readTextFile(projectPath);
      const parsed = parseJsonOrNull(text);
      const normalized = normalizeProject(parsed);
      setDoc(normalized);
    }, {
      action: 'localize',
      title: 'Localization Processing',
      detail: 'Preparing localization run...'
    });
  }, [persistProjectSnapshot, projectPath, runWithBusy, setDoc]);

  const handleRender = useCallback(async () => {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();
      setDetail('Rendering preview images...');
      await runPipeline('render', [projectPath, previewRenderDir]);
      await loadSlotPreviewMap();
      await loadPreviewMatrix();
    }, {
      action: 'render',
      title: 'Rendering',
      detail: 'Generating preview images...'
    });
  }, [
    loadPreviewMatrix,
    loadSlotPreviewMap,
    persistProjectSnapshot,
    previewRenderDir,
    projectPath,
    runWithBusy
  ]);

  const handleValidate = useCallback(async () => {
    await runWithBusy(async ({ setDetail }) => {
      setDetail('Saving project config...');
      await persistProjectSnapshot();
      setDetail('Checking project rules...');
      const output = await runPipeline('validate', [projectPath]);
      const parsed = parseJsonOrNull(output) as { issues?: ValidateIssue[] } | null;
      setIssues(parsed?.issues || []);
    }, {
      action: 'validate',
      title: 'Validation',
      detail: 'Checking project rules...'
    });
  }, [persistProjectSnapshot, projectPath, runWithBusy, setIssues]);

  const handleRefreshPreview = useCallback(async () => {
    await runWithBusy(async () => {
      await loadSlotPreviewMap();
      await loadPreviewMatrix();
    }, {
      action: 'refresh-preview',
      title: 'Refreshing Preview',
      detail: 'Loading latest rendered images...'
    });
  }, [loadPreviewMatrix, loadSlotPreviewMap, runWithBusy]);

  return {
    handleRunLocalization,
    handleRender,
    handleValidate,
    handleRefreshPreview
  };
}
