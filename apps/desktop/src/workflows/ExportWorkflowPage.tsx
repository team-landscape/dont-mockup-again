import { LabeledField } from '../components/form/LabeledField';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';

interface ExportWorkflowPageProps {
  outputDir: string;
  zipEnabled: boolean;
  metadataCsvEnabled: boolean;
  isBusy: boolean;
  exportStatus: string;
  exportError: string;
  onOutputDirChange: (value: string) => void;
  onPickOutputDir: () => void;
  canPickOutputDir: boolean;
  onZipEnabledChange: (checked: boolean) => void;
  onMetadataCsvEnabledChange: (checked: boolean) => void;
  onExport: () => Promise<void>;
}

export function ExportWorkflowPage({
  outputDir,
  zipEnabled,
  metadataCsvEnabled,
  isBusy,
  exportStatus,
  exportError,
  onOutputDirChange,
  onPickOutputDir,
  canPickOutputDir,
  onZipEnabledChange,
  onMetadataCsvEnabledChange,
  onExport
}: ExportWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Create dist/zip layout</CardDescription>
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

            <div className="flex items-center justify-between gap-3 rounded-md border p-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">Metadata CSV</p>
              </div>
              <Switch checked={metadataCsvEnabled} onCheckedChange={onMetadataCsvEnabledChange} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isBusy || !canPickOutputDir}
                onClick={() => { void onExport(); }}
              >
                Run Export
              </Button>
            </div>

            {!canPickOutputDir ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Export is available only in the desktop (Tauri) runtime.
              </p>
            ) : null}

            {exportStatus ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                {exportStatus}
              </p>
            ) : null}

            {exportError ? (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 p-2 text-xs text-destructive">
                {exportError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
