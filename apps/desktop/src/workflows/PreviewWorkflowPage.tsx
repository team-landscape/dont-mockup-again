import type { ReactNode } from 'react';
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

interface PreviewWorkflowPageProps {
  deviceOptions: SelectOption[];
  selectedDevice: string;
  onSelectDevice: (value: string) => void;
  localeOptions: SelectOption[];
  slotOptions: SelectOption[];
  previewPath: string;
  renderSlotPreviewCard: (params: { locale: string; slotId: string; slotLabel: string }) => ReactNode;
}

export function PreviewWorkflowPage({
  deviceOptions,
  selectedDevice,
  onSelectDevice,
  localeOptions,
  slotOptions,
  previewPath,
  renderSlotPreviewCard
}: PreviewWorkflowPageProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription className="truncate">{previewPath || 'No image loaded'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 max-w-[320px]">
            <Select value={selectedDevice} onValueChange={onSelectDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Device" />
              </SelectTrigger>
              <SelectContent>
                {deviceOptions.map((device) => (
                  <SelectItem key={device.value} value={device.value}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {localeOptions.map((locale) => (
              <div key={locale.value} className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-semibold">{locale.label}</p>
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-3 pb-1">
                    {slotOptions.map((slot) => (
                      <div key={`${locale.value}:${slot.value}`} className="w-[300px] shrink-0 rounded-md border bg-background p-2">
                        {renderSlotPreviewCard({
                          locale: locale.value,
                          slotId: slot.value,
                          slotLabel: slot.label
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
