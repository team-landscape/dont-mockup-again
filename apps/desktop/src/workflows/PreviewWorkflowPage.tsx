import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface SelectOption {
  value: string;
  label: string;
}

interface PreviewWorkflowPageProps {
  localeOptions: SelectOption[];
  slotOptions: SelectOption[];
  previewPath: string;
  renderSlotPreviewCard: (params: { locale: string; slotId: string; slotLabel: string }) => ReactNode;
}

export function PreviewWorkflowPage({
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
