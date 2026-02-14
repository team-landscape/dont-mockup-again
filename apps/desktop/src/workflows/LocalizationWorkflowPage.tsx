import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { LabeledField } from '../components/form/LabeledField';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

const appMetadataFields = [
  { key: 'app.title', label: 'Title', multiline: false },
  { key: 'app.subtitle', label: 'Subtitle', multiline: false },
  { key: 'app.description', label: 'Description', multiline: true },
  { key: 'app.patchNote', label: 'Patch Note', multiline: true }
] as const;

interface LlmConfigValue {
  command: string;
  timeoutSec: number;
  prompt?: string;
}

interface LocalizationWorkflowPageProps {
  sourceLocale: string;
  isBusy: boolean;
  isRunningLocalization: boolean;
  localizationBusyLabel: string;
  localizationStatus: string;
  localizationError: string;
  llmConfig: LlmConfigValue;
  slots: Array<{ id: string; name: string }>;
  locales: string[];
  localeManagerNode: ReactNode;
  onSourceLocaleChange: (locale: string) => void;
  onRunLocalization: () => Promise<void>;
  onLlmCommandChange: (value: string) => void;
  onLlmTimeoutSecChange: (value: number) => void;
  onLlmPromptChange: (value: string) => void;
  getCopyValue: (key: string, locale: string) => string;
  onCopyChange: (key: string, locale: string, value: string) => void;
}

export function LocalizationWorkflowPage({
  sourceLocale,
  isBusy,
  isRunningLocalization,
  localizationBusyLabel,
  localizationStatus,
  localizationError,
  llmConfig,
  slots,
  locales,
  localeManagerNode,
  onSourceLocaleChange,
  onRunLocalization,
  onLlmCommandChange,
  onLlmTimeoutSecChange,
  onLlmPromptChange,
  getCopyValue,
  onCopyChange
}: LocalizationWorkflowPageProps) {
  const localeColumnWidth = 220;
  const localeColumnCount = Math.max(locales.length, 2);
  const localeGridStyle = {
    gridTemplateColumns: `repeat(${localeColumnCount}, minmax(${localeColumnWidth}px, 1fr))`
  };
  const editorMinWidth = Math.max(980, localeColumnCount * localeColumnWidth + 80);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Localization Pipeline</CardTitle>
            <CardDescription>Configure local LLM CLI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Source Locale">
              <Select value={sourceLocale} onValueChange={onSourceLocaleChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locales.map((locale) => (
                    <SelectItem key={locale} value={locale}>{locale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Target Locales">
              {localeManagerNode}
            </LabeledField>

            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={() => { void onRunLocalization(); }}>
                {isRunningLocalization ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localizationBusyLabel || 'Processing...'}
                  </>
                ) : 'Run Localization'}
              </Button>
            </div>

            {localizationStatus ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                {localizationStatus}
              </p>
            ) : null}

            {localizationError ? (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 p-2 text-xs text-destructive">
                {localizationError}
              </p>
            ) : null}

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Local LLM CLI Config</p>
              <div className="grid gap-3">
                <LabeledField label="Command">
                  <Input value={llmConfig.command} onChange={(event) => onLlmCommandChange(event.target.value)} />
                </LabeledField>
                <LabeledField label="Timeout Sec">
                  <Input
                    type="number"
                    value={llmConfig.timeoutSec}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      if (!Number.isFinite(nextValue)) return;
                      onLlmTimeoutSecChange(nextValue);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Style Prompt">
                  <Textarea
                    value={llmConfig.prompt || ''}
                    onChange={(event) => onLlmPromptChange(event.target.value)}
                    className="min-h-[240px]"
                  />
                </LabeledField>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[calc(100vh-220px)] w-full min-w-0">
          <CardHeader>
            <CardTitle>Copy Editor</CardTitle>
            <CardDescription>{slots.length} slot(s) · {locales.length} locale(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[calc(100vh-320px)] w-full overflow-auto pr-2">
              <div className="space-y-2 pb-2" style={{ minWidth: `${editorMinWidth}px` }}>
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">APP METADATA</p>
                  <div className="space-y-3">
                    {appMetadataFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                        <div className="grid gap-2" style={localeGridStyle}>
                          {locales.map((locale) => (
                            <LabeledField key={`${field.key}:${locale}`} label={locale}>
                              {field.multiline ? (
                                <Textarea
                                  value={getCopyValue(field.key, locale)}
                                  onChange={(event) => onCopyChange(field.key, locale, event.target.value)}
                                  className="min-h-[100px]"
                                />
                              ) : (
                                <Input
                                  value={getCopyValue(field.key, locale)}
                                  onChange={(event) => onCopyChange(field.key, locale, event.target.value)}
                                />
                              )}
                            </LabeledField>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {slots.map((slot) => (
                  <div key={slot.id} className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">{slot.name} ({slot.id})</p>
                    <div className="space-y-3">
                      {(['title', 'subtitle'] as const).map((field) => {
                        const key = `${slot.id}.${field}`;
                        return (
                          <div key={key} className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field}</p>
                            <div className="grid gap-2" style={localeGridStyle}>
                              {locales.map((locale) => (
                                <LabeledField key={`${key}:${locale}`} label={locale}>
                                  <Input
                                    value={getCopyValue(key, locale)}
                                    onChange={(event) => onCopyChange(key, locale, event.target.value)}
                                  />
                                </LabeledField>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
