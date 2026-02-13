import type { ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';

interface SelectOption {
  value: string;
  label: string;
}

interface ValidateIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

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

interface PreviewWorkflowPageProps {
  selectedDevice: string;
  selectedLocale: string;
  selectedSlot: string;
  deviceOptions: SelectOption[];
  localeOptions: SelectOption[];
  slotOptions: SelectOption[];
  isBusy: boolean;
  expectedPreviewPath: string;
  previewPath: string;
  previewDataUrl?: string;
  previewMatrixDataUrls: Record<string, Record<string, string>>;
  slotSourceDataUrls: Record<string, string>;
  issues: ValidateIssue[];
  getCopyValue: (key: string, locale: string) => string;
  onSelectDevice: (deviceId: string) => void;
  onSelectLocale: (locale: string) => void;
  onSelectSlot: (slotId: string) => void;
  onRender: () => void;
  onValidate: () => void;
  onRefreshPreview: () => void;
}

export function PreviewWorkflowPage({
  selectedDevice,
  selectedLocale,
  selectedSlot,
  deviceOptions,
  localeOptions,
  slotOptions,
  isBusy,
  expectedPreviewPath,
  previewPath,
  previewDataUrl,
  previewMatrixDataUrls,
  slotSourceDataUrls,
  issues,
  getCopyValue,
  onSelectDevice,
  onSelectLocale,
  onSelectSlot,
  onRender,
  onValidate,
  onRefreshPreview
}: PreviewWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Render Controls</CardTitle>
            <CardDescription>렌더/검증/프리뷰 로드</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Device">
              <Select value={selectedDevice} onValueChange={onSelectDevice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {deviceOptions.map((device) => (
                    <SelectItem key={device.value} value={device.value}>{device.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Locale">
              <Select value={selectedLocale} onValueChange={onSelectLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {localeOptions.map((locale) => (
                    <SelectItem key={locale.value} value={locale.value}>{locale.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Slot">
              <Select value={selectedSlot} onValueChange={onSelectSlot}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {slotOptions.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={onRender}>Render</Button>
              <Button disabled={isBusy} variant="outline" onClick={onValidate}>Validate</Button>
              <Button disabled={isBusy} variant="secondary" onClick={onRefreshPreview}><RefreshCcw className="mr-1 h-4 w-4" />Refresh</Button>
            </div>

            <p className="rounded-md border bg-muted/60 p-2 text-xs">{expectedPreviewPath}</p>

            <div className="space-y-2">
              <p className="text-sm font-medium">Validation Issues</p>
              {issues.length === 0 ? (
                <Badge variant="secondary">No issues</Badge>
              ) : (
                <div className="grid gap-2">
                  {issues.map((issue, index) => (
                    <div key={`${issue.code}:${index}`} className="rounded-md border p-2">
                      <Badge variant={issue.level === 'error' ? 'destructive' : 'outline'}>
                        {issue.level.toUpperCase()} · {issue.code}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription className="truncate">{previewPath || 'No image loaded'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {localeOptions.map((locale) => (
                <div key={locale.value} className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-sm font-semibold">{locale.label}</p>
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max gap-3 pb-1">
                      {slotOptions.map((slot) => {
                        const renderedImageUrl = previewMatrixDataUrls[locale.value]?.[slot.value];
                        const sourceImageUrl = slotSourceDataUrls[slot.value];
                        const imageUrl = renderedImageUrl || sourceImageUrl;
                        const title = getCopyValue(`${slot.value}.title`, locale.value);
                        const subtitle = getCopyValue(`${slot.value}.subtitle`, locale.value);
                        return (
                          <div key={`${locale.value}:${slot.value}`} className="w-[300px] shrink-0 rounded-md border bg-background p-2">
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">{slot.label}</p>
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`${locale.label} ${slot.label}`}
                                className="mb-2 h-auto max-h-[420px] w-full rounded-md border object-contain"
                              />
                            ) : (
                              <div className="mb-2 grid h-[220px] place-items-center rounded-md border border-dashed text-xs text-muted-foreground">
                                Render 후 Preview가 표시됩니다
                              </div>
                            )}
                            <p className="text-sm font-medium leading-tight">{title || '-'}</p>
                            <p className="mt-1 text-xs leading-tight text-muted-foreground">{subtitle || '-'}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
