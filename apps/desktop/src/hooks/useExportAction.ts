import { useCallback } from 'react';

import { runPipeline, isTauriRuntime } from '../lib/desktop-runtime';
import {
  collectExpectedRenderSuffixes,
  findMissingRenderedFiles,
  renderExportImagesFromSnapshot
} from '../lib/export-preview-renderer';
import { withTimeout } from '../lib/async-utils';
import { parseJsonOrNull } from '../lib/json-utils';
import type { StoreShotDoc } from '../lib/project-model';
import type { BusyHelpers, BusyRunOptions } from './useBusyRunner';

interface UseExportActionArgs {
  doc: StoreShotDoc;
  outputDir: string;
  previewRenderDir: string;
  projectPath: string;
  templateImageUrls: Record<string, string>;
  resolveOutputDir: (value: string | undefined) => string;
  runWithBusy: (action: (helpers: BusyHelpers) => Promise<void>, options?: BusyRunOptions) => Promise<void>;
  persistProjectSnapshot: (options?: { syncTemplateMain?: boolean }) => Promise<StoreShotDoc>;
  setOutputDir: (value: string) => void;
  setExportStatus: (value: string) => void;
  setExportError: (value: string) => void;
}

export function useExportAction({
  doc,
  outputDir,
  previewRenderDir,
  projectPath,
  templateImageUrls,
  resolveOutputDir,
  runWithBusy,
  persistProjectSnapshot,
  setOutputDir,
  setExportStatus,
  setExportError
}: UseExportActionArgs) {
  return useCallback(async () => {
    setExportStatus('');
    setExportError('');

    if (!isTauriRuntime()) {
      setExportError('Export is available only in desktop runtime. Start with `npm --prefix apps/desktop run tauri:dev`.');
      return;
    }

    try {
      await runWithBusy(async ({ setDetail }) => {
        const flags: string[] = [];
        if (doc.pipelines.export.zip) flags.push('--zip');
        if (doc.pipelines.export.metadataCsv) flags.push('--metadata-csv');
        const resolvedOutputDir = resolveOutputDir(outputDir);
        if (resolvedOutputDir !== outputDir) {
          setOutputDir(resolvedOutputDir);
        }

        setDetail('Saving project config...');
        const snapshot = await persistProjectSnapshot({ syncTemplateMain: false });
        const expectedSuffixes = collectExpectedRenderSuffixes(snapshot);
        if (expectedSuffixes.length === 0) {
          throw new Error('No export targets found. Check slots/locales/devices/platforms.');
        }

        await renderExportImagesFromSnapshot({
          snapshot,
          targetDir: previewRenderDir,
          templateImageUrls,
          runWithTimeout: withTimeout,
          onProgress: setDetail
        });
        setDetail('Verifying preview renders...');
        const previewCheck = await findMissingRenderedFiles(previewRenderDir, expectedSuffixes);
        if (previewCheck.missing.length > 0) {
          throw new Error(`Preview render missing ${previewCheck.missing.length} file(s). Example: ${previewCheck.missing[0]}`);
        }

        setDetail('Exporting preview renders...');
        const exportRaw = await runPipeline('export', [projectPath, previewRenderDir, resolvedOutputDir, ...flags]);
        const exportParsed = parseJsonOrNull(exportRaw) as {
          outputDir?: string;
          zipPath?: string | null;
          metadataCsvPath?: string | null;
        } | null;
        const outputPath = exportParsed?.outputDir || resolvedOutputDir;

        setDetail('Verifying exported files...');
        const exportCheck = await findMissingRenderedFiles(outputPath, expectedSuffixes);
        if (exportCheck.missing.length > 0) {
          throw new Error(`Export output missing ${exportCheck.missing.length} file(s). Example: ${exportCheck.missing[0]}`);
        }

        const extras = [
          exportParsed?.zipPath ? `zip: ${exportParsed.zipPath}` : '',
          exportParsed?.metadataCsvPath ? `csv: ${exportParsed.metadataCsvPath}` : ''
        ].filter(Boolean).join(' | ');
        setExportStatus(extras ? `Exported to ${outputPath} (${extras})` : `Exported to ${outputPath}`);
      }, {
        action: 'export',
        title: 'Exporting',
        detail: 'Preparing export...'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message);
    }
  }, [
    doc,
    outputDir,
    persistProjectSnapshot,
    previewRenderDir,
    projectPath,
    resolveOutputDir,
    runWithBusy,
    setExportError,
    setExportStatus,
    setOutputDir,
    templateImageUrls
  ]);
}
