import { LocaleSelector } from '../components/form/InspectorControls';
import { LocalizationWorkflowPage } from './LocalizationWorkflowPage';
import type { Slot } from '../lib/project-model';

interface LlmConfigValue {
  command: string;
  timeoutSec: number;
  prompt?: string;
}

interface LocalizationStepPanelProps {
  sourceLocale: string;
  isBusy: boolean;
  localizationBusyLabel: string;
  localizationStatus: string;
  localizationError: string;
  llmConfig: LlmConfigValue;
  slots: Slot[];
  locales: string[];
  localeOptions: string[];
  onLocalizationLocalesChange: (locales: string[]) => void;
  onSourceLocaleChange: (locale: string) => void;
  onRunLocalization: () => Promise<void>;
  onLlmCommandChange: (value: string) => void;
  onLlmTimeoutSecChange: (value: number) => void;
  onLlmPromptChange: (value: string) => void;
  getCopyValue: (key: string, locale: string) => string;
  onCopyChange: (key: string, locale: string, value: string) => void;
}

export function LocalizationStepPanel({
  sourceLocale,
  isBusy,
  localizationBusyLabel,
  localizationStatus,
  localizationError,
  llmConfig,
  slots,
  locales,
  localeOptions,
  onLocalizationLocalesChange,
  onSourceLocaleChange,
  onRunLocalization,
  onLlmCommandChange,
  onLlmTimeoutSecChange,
  onLlmPromptChange,
  getCopyValue,
  onCopyChange
}: LocalizationStepPanelProps) {
  return (
    <LocalizationWorkflowPage
      sourceLocale={sourceLocale}
      isBusy={isBusy}
      isRunningLocalization={isBusy}
      localizationBusyLabel={localizationBusyLabel}
      localizationStatus={localizationStatus}
      localizationError={localizationError}
      llmConfig={llmConfig}
      slots={slots.map((slot) => ({ id: slot.id, name: slot.name }))}
      locales={locales}
      localeManagerNode={(
        <LocaleSelector
          value={locales}
          options={localeOptions}
          onChange={onLocalizationLocalesChange}
        />
      )}
      onSourceLocaleChange={onSourceLocaleChange}
      onRunLocalization={onRunLocalization}
      onLlmCommandChange={onLlmCommandChange}
      onLlmTimeoutSecChange={onLlmTimeoutSecChange}
      onLlmPromptChange={onLlmPromptChange}
      getCopyValue={getCopyValue}
      onCopyChange={onCopyChange}
    />
  );
}
