import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface LabeledFieldProps {
  label: string;
  children: ReactNode;
}

function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

interface LlmConfigValue {
  command: string;
  argsTemplate: string[];
  timeoutSec: number;
  promptVersion: string;
  styleGuidePath?: string;
}

interface LocalizationWorkflowPageProps {
  sourceLocale: string;
  byoyPath: string;
  isBusy: boolean;
  isRunningLocalization: boolean;
  localizationBusyLabel: string;
  llmConfig: LlmConfigValue;
  slots: Array<{ id: string; name: string }>;
  locales: string[];
  localeManagerNode: ReactNode;
  onSourceLocaleChange: (locale: string) => void;
  onByoyPathChange: (path: string) => void;
  onImportByoy: () => void;
  onRunLocalization: () => void;
  onLlmCommandChange: (value: string) => void;
  onLlmArgsTemplateChange: (value: string[]) => void;
  onLlmTimeoutSecChange: (value: number) => void;
  onLlmPromptVersionChange: (value: string) => void;
  onLlmStyleGuidePathChange: (value: string) => void;
  getCopyValue: (key: string, locale: string) => string;
  onCopyChange: (key: string, locale: string, value: string) => void;
}

export function LocalizationWorkflowPage({
  sourceLocale,
  byoyPath,
  isBusy,
  isRunningLocalization,
  localizationBusyLabel,
  llmConfig,
  slots,
  locales,
  localeManagerNode,
  onSourceLocaleChange,
  onByoyPathChange,
  onImportByoy,
  onRunLocalization,
  onLlmCommandChange,
  onLlmArgsTemplateChange,
  onLlmTimeoutSecChange,
  onLlmPromptVersionChange,
  onLlmStyleGuidePathChange,
  getCopyValue,
  onCopyChange
}: LocalizationWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Localization Pipeline</CardTitle>
            <CardDescription>Local LLM CLI 설정</CardDescription>
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
              <Button disabled={isBusy} onClick={onRunLocalization}>
                {isRunningLocalization ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localizationBusyLabel || 'Processing...'}
                  </>
                ) : 'Run Localization'}
              </Button>
            </div>

            <LabeledField label="JSON Import Path (optional seed)">
              <Input value={byoyPath} onChange={(event) => onByoyPathChange(event.target.value)} />
            </LabeledField>
            <Button variant="outline" disabled={isBusy} onClick={onImportByoy}>Import JSON to Copy</Button>

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Local LLM CLI Config</p>
              <div className="grid gap-3">
                <LabeledField label="Command">
                  <Input value={llmConfig.command} onChange={(event) => onLlmCommandChange(event.target.value)} />
                </LabeledField>
                <LabeledField label="Args Template (comma separated)">
                  <Input
                    value={llmConfig.argsTemplate.join(', ')}
                    onChange={(event) => {
                      const nextArgs = event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean);
                      onLlmArgsTemplateChange(nextArgs);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Prompt Version">
                  <Input value={llmConfig.promptVersion} onChange={(event) => onLlmPromptVersionChange(event.target.value)} />
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
                <LabeledField label="Style Guide Path">
                  <Input value={llmConfig.styleGuidePath || ''} onChange={(event) => onLlmStyleGuidePathChange(event.target.value)} />
                </LabeledField>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[calc(100vh-220px)]">
          <CardHeader>
            <CardTitle>Copy Editor</CardTitle>
            <CardDescription>{slots.length} slot(s) · {locales.length} locale(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-320px)] pr-2">
              <div className="space-y-2">
                {slots.map((slot) => (
                  <div key={slot.id} className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">{slot.name} ({slot.id})</p>
                    <div className="space-y-3">
                      {(['title', 'subtitle'] as const).map((field) => {
                        const key = `${slot.id}.${field}`;
                        return (
                          <div key={key} className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field}</p>
                            <div className="grid gap-2 md:grid-cols-2">
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
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
