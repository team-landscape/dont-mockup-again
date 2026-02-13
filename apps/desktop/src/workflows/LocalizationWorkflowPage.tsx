import type { ReactNode } from 'react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';

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

interface ByokConfigValue {
  baseUrl: string;
  endpointPath: string;
  model: string;
  apiKeyEnv: string;
  timeoutSec: number;
  promptVersion: string;
  styleGuidePath?: string;
}

interface LocalizationWorkflowPageProps {
  mode: 'byok' | 'llm-cli';
  sourceLocale: string;
  byoyPath: string;
  isBusy: boolean;
  byokConfig: ByokConfigValue;
  llmConfig: LlmConfigValue;
  slots: Array<{ id: string; name: string }>;
  locales: string[];
  localeManagerNode: ReactNode;
  onModeChange: (mode: 'byok' | 'llm-cli') => void;
  onSourceLocaleChange: (locale: string) => void;
  onByoyPathChange: (path: string) => void;
  onImportByoy: () => void;
  onRunLocalization: () => void;
  onByokBaseUrlChange: (value: string) => void;
  onByokEndpointPathChange: (value: string) => void;
  onByokModelChange: (value: string) => void;
  onByokApiKeyEnvChange: (value: string) => void;
  onByokPromptVersionChange: (value: string) => void;
  onByokTimeoutSecChange: (value: number) => void;
  onByokStyleGuidePathChange: (value: string) => void;
  onLlmCommandChange: (value: string) => void;
  onLlmArgsTemplateChange: (value: string[]) => void;
  onLlmTimeoutSecChange: (value: number) => void;
  onLlmPromptVersionChange: (value: string) => void;
  onLlmStyleGuidePathChange: (value: string) => void;
  getCopyValue: (key: string, locale: string) => string;
  onCopyChange: (key: string, locale: string, value: string) => void;
}

export function LocalizationWorkflowPage({
  mode,
  sourceLocale,
  byoyPath,
  isBusy,
  byokConfig,
  llmConfig,
  slots,
  locales,
  localeManagerNode,
  onModeChange,
  onSourceLocaleChange,
  onByoyPathChange,
  onImportByoy,
  onRunLocalization,
  onByokBaseUrlChange,
  onByokEndpointPathChange,
  onByokModelChange,
  onByokApiKeyEnvChange,
  onByokPromptVersionChange,
  onByokTimeoutSecChange,
  onByokStyleGuidePathChange,
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
            <CardDescription>BYOK 또는 Local LLM CLI 설정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Mode">
              <Select value={mode} onValueChange={(value) => onModeChange(value as 'byok' | 'llm-cli')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="byok">BYOK (OpenAI-compatible API)</SelectItem>
                  <SelectItem value="llm-cli">Local LLM CLI</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

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
              <Button disabled={isBusy} onClick={onRunLocalization}>Run Localization</Button>
            </div>

            <LabeledField label="JSON Import Path (optional seed)">
              <Input value={byoyPath} onChange={(event) => onByoyPathChange(event.target.value)} />
            </LabeledField>
            <Button variant="outline" disabled={isBusy} onClick={onImportByoy}>Import JSON to Copy</Button>

            {mode === 'byok' ? (
              <div className="rounded-md border p-3">
                <p className="mb-3 text-sm font-medium">BYOK Config</p>
                <div className="grid gap-3">
                  <LabeledField label="Base URL">
                    <Input value={byokConfig.baseUrl} onChange={(event) => onByokBaseUrlChange(event.target.value)} />
                  </LabeledField>
                  <LabeledField label="Endpoint Path">
                    <Input value={byokConfig.endpointPath} onChange={(event) => onByokEndpointPathChange(event.target.value)} />
                  </LabeledField>
                  <LabeledField label="Model">
                    <Input value={byokConfig.model} onChange={(event) => onByokModelChange(event.target.value)} />
                  </LabeledField>
                  <LabeledField label="API Key ENV">
                    <Input value={byokConfig.apiKeyEnv} onChange={(event) => onByokApiKeyEnvChange(event.target.value)} />
                  </LabeledField>
                  <LabeledField label="Prompt Version">
                    <Input value={byokConfig.promptVersion} onChange={(event) => onByokPromptVersionChange(event.target.value)} />
                  </LabeledField>
                  <LabeledField label="Timeout Sec">
                    <Input
                      type="number"
                      value={byokConfig.timeoutSec}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (!Number.isFinite(nextValue)) return;
                        onByokTimeoutSecChange(nextValue);
                      }}
                    />
                  </LabeledField>
                  <LabeledField label="Style Guide Path">
                    <Input value={byokConfig.styleGuidePath || ''} onChange={(event) => onByokStyleGuidePathChange(event.target.value)} />
                  </LabeledField>
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <Card className="xl:min-h-[780px]">
          <CardHeader>
            <CardTitle>Copy Editor</CardTitle>
            <CardDescription>{slots.length} slot(s) · {locales.length} locale(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[620px] xl:h-[700px] pr-2">
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
