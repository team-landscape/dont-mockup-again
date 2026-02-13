import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { LabeledField } from '../components/form/LabeledField';
import type { SelectOption } from '../types/ui';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';

interface ScreensWorkflowPageProps {
  canvasNode: ReactNode;
  inspectorNode: ReactNode;
  isXlLayout: boolean;
  selectedDevice: string;
  selectedSlot: string;
  slotCount: number;
  deviceOptions: SelectOption[];
  slotOptions: SelectOption[];
  onSelectDevice: (deviceId: string) => void;
  onSelectSlot: (slotId: string) => void;
  onAddSlot: () => void;
}

export function ScreensWorkflowPage({
  canvasNode,
  inspectorNode,
  isXlLayout,
  selectedDevice,
  selectedSlot,
  slotCount,
  deviceOptions,
  slotOptions,
  onSelectDevice,
  onSelectSlot,
  onAddSlot
}: ScreensWorkflowPageProps) {
  return (
    <div className="relative mt-0 h-[calc(100vh-2.5rem)] overflow-hidden rounded-xl border">
      {canvasNode}

      <div className="pointer-events-none fixed left-3 top-[13.5rem] z-30 w-[min(560px,calc(100%-1.5rem))] lg:left-[15.5rem] lg:top-3 lg:w-[min(560px,calc(100%-17.5rem))] xl:w-[540px]">
        <Card className="pointer-events-auto bg-card/95 shadow-2xl backdrop-blur">
          <CardHeader className="gap-3 pb-2">
            <div className="space-y-2">
              <CardTitle>Screens Composer</CardTitle>
              <CardDescription>캔버스 위에서 슬롯을 배치하고 바로 편집합니다.</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedDevice}</Badge>
                <Badge variant="outline">{slotCount} slots</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onAddSlot}><Plus className="mr-1 h-4 w-4" />Add Slot</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
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

            <LabeledField label="Selected Slot">
              <Select value={selectedSlot} onValueChange={onSelectSlot}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {slotOptions.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>
          </CardContent>
        </Card>
      </div>

      {isXlLayout ? (
        <div className="pointer-events-none fixed right-3 top-3 z-30 w-[460px]">
          <div data-native-wheel className="pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
            <ScrollArea className="h-[calc(100vh-8rem)] pr-2">
              {inspectorNode}
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30">
          <div data-native-wheel className="pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
            <ScrollArea className="h-[42vh] pr-2">
              {inspectorNode}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
