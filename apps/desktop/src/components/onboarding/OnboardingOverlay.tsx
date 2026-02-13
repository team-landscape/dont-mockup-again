import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { LocaleSelector, SwitchRow } from '../form/InspectorControls';
import { devicePresets, type Device, type Platform } from '../../lib/project-model';

interface OnboardingOverlayProps {
  open: boolean;
  locales: string[];
  localeOptions: string[];
  platforms: Platform[];
  devices: Device[];
  ready: boolean;
  onLocalesChange: (locales: string[]) => void;
  onPlatformToggle: (platform: Platform, checked: boolean) => void;
  onDeviceToggle: (device: Device, checked: boolean) => void;
  onStart: () => void;
}

export function OnboardingOverlay({
  open,
  locales,
  localeOptions,
  platforms,
  devices,
  ready,
  onLocalesChange,
  onPlatformToggle,
  onDeviceToggle,
  onStart
}: OnboardingOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-[760px] shadow-2xl">
        <CardHeader>
          <CardTitle>Welcome to Don't Mockup Again</CardTitle>
          <CardDescription>First-run setup. Select locale, platform, and device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Locales</p>
            <LocaleSelector
              value={locales}
              options={localeOptions}
              onChange={onLocalesChange}
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Platforms & Devices</p>
            <SwitchRow
              label="iOS"
              checked={platforms.includes('ios')}
              onCheckedChange={(checked) => onPlatformToggle('ios', checked)}
            />
            <SwitchRow
              label="Android"
              checked={platforms.includes('android')}
              onCheckedChange={(checked) => onPlatformToggle('android', checked)}
            />
            <div className="space-y-1.5 rounded-md border p-1.5">
              {devicePresets.map((preset) => (
                <SwitchRow
                  key={preset.value.id}
                  label={preset.label}
                  checked={devices.some((device) => device.id === preset.value.id)}
                  onCheckedChange={(checked) => onDeviceToggle(preset.value, checked)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {ready ? 'Ready to start.' : 'At least 1 locale, 1 platform, and 1 device are required.'}
            </p>
            <Button disabled={!ready} onClick={onStart}>
              Start
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
