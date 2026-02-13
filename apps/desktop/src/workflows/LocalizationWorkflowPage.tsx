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
  glossaryPath?: string;
  styleGuidePath?: string;
}

interface LocalizationWorkflowPageProps {
  mode: 'byoy' | 'llm-cli';
  byoyPath: string;
  isBusy: boolean;
  llmConfig: LlmConfigValue;
  copyKeys: string[];
  locales: string[];
  onModeChange: (mode: 'byoy' | 'llm-cli') => void;
  onByoyPathChange: (path: string) => void;
  onImportByoy: () => void;
  onLlmCommandChange: (value: string) => void;
  onLlmArgsTemplateChange: (value: string[]) => void;
  onLlmTimeoutSecChange: (value: number) => void;
  onLlmGlossaryPathChange: (value: string) => void;
  onLlmStyleGuidePathChange: (value: string) => void;
  getCopyValue: (key: string, locale: string) => string;
  onCopyChange: (key: string, locale: string, value: string) => void;
}

export function LocalizationWorkflowPage({
  mode,
  byoyPath,
  isBusy,
  llmConfig,
  copyKeys,
  locales,
  onModeChange,
  onByoyPathChange,
  onImportByoy,
  onLlmCommandChange,
  onLlmArgsTemplateChange,
  onLlmTimeoutSecChange,
  onLlmGlossaryPathChange,
  onLlmStyleGuidePathChange,
  getCopyValue,
  onCopyChange
}: LocalizationWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Localization Pipeline</CardTitle>
            <CardDescription>BYOY import 또는 LLM CLI 설정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Mode">
              <Select value={mode} onValueChange={(value) => onModeChange(value as 'byoy' | 'llm-cli')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="byoy">BYOY</SelectItem>
                  <SelectItem value="llm-cli">LLM CLI</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="BYOY JSON Path">
              <Input value={byoyPath} onChange={(event) => onByoyPathChange(event.target.value)} />
            </LabeledField>
            <Button variant="outline" disabled={isBusy} onClick={onImportByoy}>Import BYOY JSON</Button>

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">LLM CLI Config</p>
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
                <LabeledField label="Glossary Path">
                  <Input value={llmConfig.glossaryPath || ''} onChange={(event) => onLlmGlossaryPathChange(event.target.value)} />
                </LabeledField>
                <LabeledField label="Style Guide Path">
                  <Input value={llmConfig.styleGuidePath || ''} onChange={(event) => onLlmStyleGuidePathChange(event.target.value)} />
                </LabeledField>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Copy Editor</CardTitle>
            <CardDescription>{locales.length} locale(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[520px] pr-2">
              <div className="space-y-2">
                {copyKeys.map((key) => (
                  <div key={key} className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">{key}</p>
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
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
