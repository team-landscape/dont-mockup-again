import { useCallback } from 'react';

import type { LlmCliConfig, ProjectDoc } from '../lib/project-model';

interface UseProjectWorkflowActionsArgs {
  updateDoc: (mutator: (next: ProjectDoc) => void) => void;
  upsertLlmConfig: (mutator: (cfg: LlmCliConfig) => void) => void;
}

export function useProjectWorkflowActions({
  updateDoc,
  upsertLlmConfig
}: UseProjectWorkflowActionsArgs) {
  const handleLocalizationLocalesChange = useCallback((locales: string[]) => {
    updateDoc((next) => {
      if (locales.length === 0) return;
      next.project.locales = locales;
    });
  }, [updateDoc]);

  const handleSourceLocaleChange = useCallback((locale: string) => {
    updateDoc((next) => {
      next.pipelines.localization.sourceLocale = locale;
    });
  }, [updateDoc]);

  const handleLlmCommandChange = useCallback((value: string) => {
    upsertLlmConfig((cfg) => {
      cfg.command = value;
    });
  }, [upsertLlmConfig]);

  const handleLlmTimeoutSecChange = useCallback((value: number) => {
    upsertLlmConfig((cfg) => {
      cfg.timeoutSec = value;
    });
  }, [upsertLlmConfig]);

  const handleLlmPromptChange = useCallback((value: string) => {
    upsertLlmConfig((cfg) => {
      cfg.prompt = value;
    });
  }, [upsertLlmConfig]);

  const handleZipEnabledChange = useCallback((checked: boolean) => {
    updateDoc((next) => {
      next.pipelines.export.zip = checked;
    });
  }, [updateDoc]);

  const handleMetadataCsvEnabledChange = useCallback((checked: boolean) => {
    updateDoc((next) => {
      next.pipelines.export.metadataCsv = checked;
    });
  }, [updateDoc]);

  const handleOnboardingLocalesChange = useCallback((locales: string[]) => {
    updateDoc((next) => {
      next.project.locales = locales;
    });
  }, [updateDoc]);

  return {
    handleLocalizationLocalesChange,
    handleSourceLocaleChange,
    handleLlmCommandChange,
    handleLlmTimeoutSecChange,
    handleLlmPromptChange,
    handleZipEnabledChange,
    handleMetadataCsvEnabledChange,
    handleOnboardingLocalesChange
  };
}
