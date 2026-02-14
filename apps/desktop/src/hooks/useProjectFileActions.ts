import { useCallback } from 'react';

import { isTauriRuntime, pickProjectFile, pickProjectSavePath, readTextFile, writeTextFile } from '../lib/desktop-runtime';
import { parseJsonOrNull } from '../lib/json-utils';
import {
  type ProjectDoc,
  TEMPLATE_REFERENCE_WIDTH,
  buildProjectSnapshotForPersistence,
  createDefaultProject,
  getParentDirectory,
  normalizeProject,
  serializeProjectSignature
} from '../lib/project-model';
import type { BusyHelpers, BusyRunOptions } from './useBusyRunner';

interface UseProjectFileActionsArgs {
  projectPath: string;
  outputDir: string;
  defaultExportDir: string;
  defaultProjectFileName: string;
  hasUnsavedChanges: boolean;
  doc: ProjectDoc;
  resolveOutputDir: (value: string | undefined) => string;
  runWithBusy: (action: (helpers: BusyHelpers) => Promise<void>, options?: BusyRunOptions) => Promise<void>;
  setDoc: (value: ProjectDoc) => void;
  setOutputDir: (value: string) => void;
  setIssues: (value: Array<{ level: 'error' | 'warning'; code: string; message: string }>) => void;
  setProjectPath: (value: string) => void;
  setSavedProjectSignature: (value: string) => void;
  setProjectError: (value: string) => void;
  setProjectStatus: (value: string) => void;
}

export function useProjectFileActions({
  projectPath,
  outputDir,
  defaultExportDir,
  defaultProjectFileName,
  hasUnsavedChanges,
  doc,
  resolveOutputDir,
  runWithBusy,
  setDoc,
  setOutputDir,
  setIssues,
  setProjectPath,
  setSavedProjectSignature,
  setProjectError,
  setProjectStatus
}: UseProjectFileActionsArgs) {
  const handleLoadProject = useCallback(async () => {
    if (!isTauriRuntime()) {
      setProjectError('Load is available only in desktop runtime.');
      return;
    }

    try {
      const preferredDir = getParentDirectory(projectPath) || defaultExportDir || undefined;
      const pickedPath = await pickProjectFile(preferredDir);
      if (!pickedPath || !pickedPath.trim()) {
        setProjectStatus('Load cancelled.');
        setProjectError('');
        return;
      }

      await runWithBusy(async () => {
        const text = await readTextFile(pickedPath);
        const parsed = parseJsonOrNull(text);
        const normalized = normalizeProject(parsed);
        const resolvedLoadedOutputDir = resolveOutputDir(normalized.pipelines.export.outputDir);
        const loadedSnapshot = buildProjectSnapshotForPersistence(normalized, resolvedLoadedOutputDir, {
          syncTemplateMain: true,
          slotWidth: TEMPLATE_REFERENCE_WIDTH
        });
        setDoc(normalized);
        setOutputDir(resolvedLoadedOutputDir);
        setProjectPath(pickedPath);
        setSavedProjectSignature(serializeProjectSignature(loadedSnapshot));
      }, {
        action: 'load-project',
        title: 'Loading Project',
        detail: 'Reading project file...'
      });
      setProjectError('');
      setProjectStatus(`Loaded ${pickedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
    }
  }, [
    defaultExportDir,
    projectPath,
    resolveOutputDir,
    runWithBusy,
    setDoc,
    setOutputDir,
    setProjectError,
    setProjectPath,
    setProjectStatus,
    setSavedProjectSignature
  ]);

  const handleSaveProject = useCallback(async (options?: { cancelStatus?: string }): Promise<boolean> => {
    if (!isTauriRuntime()) {
      setProjectError('Save is available only in desktop runtime.');
      return false;
    }

    try {
      let targetPath = projectPath.trim();
      const cancelStatus = options?.cancelStatus || 'Save cancelled.';
      if (!targetPath) {
        const preferredDir = defaultExportDir || undefined;
        const pickedPath = await pickProjectSavePath(defaultProjectFileName, preferredDir);
        if (!pickedPath || !pickedPath.trim()) {
          setProjectStatus(cancelStatus);
          setProjectError('');
          return false;
        }
        targetPath = pickedPath;
      }

      await runWithBusy(async () => {
        const next = buildProjectSnapshotForPersistence(doc, resolveOutputDir(outputDir), {
          syncTemplateMain: true,
          slotWidth: TEMPLATE_REFERENCE_WIDTH
        });
        await writeTextFile(targetPath, JSON.stringify(next, null, 2));
        setProjectPath(targetPath);
        setSavedProjectSignature(serializeProjectSignature(next));
      }, {
        action: 'save-project',
        title: 'Saving Project',
        detail: 'Writing project changes...'
      });
      setProjectError('');
      setProjectStatus(`Saved ${targetPath}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
      return false;
    }
  }, [
    defaultExportDir,
    defaultProjectFileName,
    doc,
    outputDir,
    projectPath,
    resolveOutputDir,
    runWithBusy,
    setProjectError,
    setProjectPath,
    setProjectStatus,
    setSavedProjectSignature
  ]);

  const handleCreateNewProject = useCallback(async () => {
    if (hasUnsavedChanges) {
      const shouldSave = typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm('You have unsaved changes. Save before creating a new project?');

      if (!shouldSave) {
        setProjectStatus('New cancelled.');
        setProjectError('');
        return;
      }

      const saved = await handleSaveProject({ cancelStatus: 'New cancelled (save cancelled).' });
      if (!saved) {
        return;
      }
    }

    const fresh = createDefaultProject();
    const resolvedFreshOutputDir = resolveOutputDir(fresh.pipelines.export.outputDir);
    const freshSnapshot = buildProjectSnapshotForPersistence(fresh, resolvedFreshOutputDir, {
      syncTemplateMain: true,
      slotWidth: TEMPLATE_REFERENCE_WIDTH
    });
    setDoc(fresh);
    setOutputDir(resolvedFreshOutputDir);
    setIssues([]);
    setProjectPath('');
    setSavedProjectSignature(serializeProjectSignature(freshSnapshot));
    setProjectError('');
    setProjectStatus('Started a new project (unsaved). Use Save to choose a file.');
  }, [
    handleSaveProject,
    hasUnsavedChanges,
    resolveOutputDir,
    setDoc,
    setIssues,
    setOutputDir,
    setProjectError,
    setProjectPath,
    setProjectStatus,
    setSavedProjectSignature
  ]);

  return {
    handleLoadProject,
    handleSaveProject,
    handleCreateNewProject
  };
}
