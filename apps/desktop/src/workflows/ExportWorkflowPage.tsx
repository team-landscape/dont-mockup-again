import type { ReactNode } from 'react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';

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

interface ExportWorkflowPageProps {
  outputDir: string;
  zipEnabled: boolean;
  renderDir: string;
  isBusy: boolean;
  onOutputDirChange: (value: string) => void;
  onPickOutputDir: () => void;
  canPickOutputDir: boolean;
  onZipEnabledChange: (checked: boolean) => void;
  onExport: () => void;
}

export function ExportWorkflowPage({
  outputDir,
  zipEnabled,
  renderDir,
  isBusy,
  onOutputDirChange,
  onPickOutputDir,
  canPickOutputDir,
  onZipEnabledChange,
  onExport
}: ExportWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>dist/zip layout 생성</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Output Dir">
              <div className="flex gap-2">
                <Input value={outputDir} onChange={(event) => onOutputDirChange(event.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy || !canPickOutputDir}
                  onClick={onPickOutputDir}
                >
                  Choose Folder
                </Button>
              </div>
            </LabeledField>

            <div className="flex items-center justify-between gap-3 rounded-md border p-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">Create zip</p>
              </div>
              <Switch checked={zipEnabled} onCheckedChange={onZipEnabledChange} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={onExport}>Run Export</Button>
            </div>

            <p className="rounded-md border bg-muted/60 p-2 text-xs">Render Dir: {renderDir}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
