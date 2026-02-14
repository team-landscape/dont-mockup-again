import { useCallback } from 'react';

import { readTextFile, runPipeline } from '../lib/desktop-runtime';
import { parseJsonOrNull } from '../lib/json-utils';
import { normalizeProject, type ProjectDoc } from '../lib/project-model';
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
  persistProjectSnapshot: (options?: { syncTemplateMain?: boolean }) => Promise<ProjectDoc>;
  loadSlotPreviewMap: () => Promise<{
    loaded: number;
    total: number;
    selectedPath: string;
  }>;
  loadPreviewMatrix: () => Promise<Record<string, Record<string, string>>>;
  setDoc: (value: ProjectDoc) => void;
  setIssues: (value: ValidateIssue[]) => void;
  setLocalizationRunning: (value: boolean) => void;
  setLocalizationBusyLabel: (value: string) => void;
  setLocalizationStatus: (value: string) => void;
  setLocalizationError: (value: string) => void;
}

export function usePipelineActions({
  projectPath,
  previewRenderDir,
  runWithBusy,
  persistProjectSnapshot,
  loadSlotPreviewMap,
  loadPreviewMatrix,
  setDoc,
  setIssues,
  setLocalizationRunning,
  setLocalizationBusyLabel,
  setLocalizationStatus,
  setLocalizationError
}: UsePipelineActionsArgs) {
  const handleRunLocalization = useCallback(async () => {
    const startedAt = Date.now();
    const minVisibleMs = 280;

    setLocalizationStatus('');
    setLocalizationError('');
    setLocalizationBusyLabel('Preparing localization run...');
    setLocalizationRunning(true);
    try {
      // Ensure the loading state is painted before starting any work.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (typeof window !== 'undefined') {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }

      setLocalizationBusyLabel('Saving project config...');
      await persistProjectSnapshot();

      setLocalizationBusyLabel('Running localization pipeline...');
      await runPipeline('localize', [projectPath, '--write']);

      setLocalizationBusyLabel('Reloading localized copy...');
      const text = await readTextFile(projectPath);
      const parsed = parseJsonOrNull(text);
      const normalized = normalizeProject(parsed);
      setDoc(normalized);

      setLocalizationStatus('Localization completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalizationError(message);
    } finally {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < minVisibleMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, minVisibleMs - elapsedMs));
      }
      setLocalizationBusyLabel('');
      setLocalizationRunning(false);
    }
  }, [
    persistProjectSnapshot,
    projectPath,
    setDoc,
    setLocalizationBusyLabel,
    setLocalizationRunning,
    setLocalizationError,
    setLocalizationStatus
  ]);

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
