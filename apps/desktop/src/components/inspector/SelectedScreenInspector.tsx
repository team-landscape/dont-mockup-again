import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { InspectorCopyFields, LabeledField } from '../form/InspectorControls';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import type { Slot } from '../../lib/project-model';

interface SelectedScreenInspectorProps {
  selectedSlotData: Slot | null;
  selectedLocale: string;
  selectedSlotNameDraft: string;
  titleValue: string;
  subtitleValue: string;
  isMoveUpDisabled: boolean;
  isMoveDownDisabled: boolean;
  templateInspectorNode: ReactNode;
  onSlotNameDraftChange: (value: string) => void;
  onCommitSlotName: () => void;
  onResetSlotNameDraft: () => void;
  onOpenSlotImagePicker: (slotId: string) => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onMoveSlotUp: () => void;
  onMoveSlotDown: () => void;
  onRemoveSlot: () => void;
}

export function SelectedScreenInspector({
  selectedSlotData,
  selectedLocale,
  selectedSlotNameDraft,
  titleValue,
  subtitleValue,
  isMoveUpDisabled,
  isMoveDownDisabled,
  templateInspectorNode,
  onSlotNameDraftChange,
  onCommitSlotName,
  onResetSlotNameDraft,
  onOpenSlotImagePicker,
  onTitleChange,
  onSubtitleChange,
  onMoveSlotUp,
  onMoveSlotDown,
  onRemoveSlot
}: SelectedScreenInspectorProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Selected Screen Inspector</CardTitle>
          <CardDescription>
            {selectedSlotData ? `${selectedSlotData.name} · ${selectedLocale}` : '선택된 슬롯이 없습니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedSlotData ? (
            <>
              <LabeledField label="Slot Name">
                <Input
                  value={selectedSlotNameDraft}
                  onChange={(event) => onSlotNameDraftChange(event.target.value)}
                  onBlur={onCommitSlotName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onCommitSlotName();
                      return;
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onResetSlotNameDraft();
                    }
                  }}
                />
              </LabeledField>

              <LabeledField label="Slot Image">
                <div className="space-y-2">
                  <p className="truncate rounded-md border bg-muted/60 p-2 text-xs">
                    {selectedSlotData.sourceImagePath || 'No slot image selected'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenSlotImagePicker(selectedSlotData.id)}
                  >
                    Choose Image
                  </Button>
                </div>
              </LabeledField>

              <InspectorCopyFields
                locale={selectedLocale}
                titleValue={titleValue}
                subtitleValue={subtitleValue}
                onTitleChange={onTitleChange}
                onSubtitleChange={onSubtitleChange}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isMoveUpDisabled}
                  onClick={onMoveSlotUp}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isMoveDownDisabled}
                  onClick={onMoveSlotDown}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={onRemoveSlot}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">슬롯을 추가하거나 선택해 주세요.</p>
          )}
        </CardContent>
      </Card>

      {templateInspectorNode}
    </div>
  );
}
