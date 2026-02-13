import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  ColorField,
  FontSelector,
  LabeledField,
  NumberField,
  SwitchRow
} from '../form/InspectorControls';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  type Align,
  type Slot,
  type TemplateBackground,
  type TemplateElement,
  type TemplateElementKind,
  type TemplateTextSource,
  clampNumber,
  clampTextWidthPercent,
  resolveHorizontalAlignedX,
  resolveTextWidthFromPercent
} from '../../lib/project-model';

interface TemplateInspectorSectionProps {
  addTemplateElement: (kind: TemplateElementKind) => void;
  openTemplateImagePicker: (elementId: string) => void;
  removeTemplateElement: (elementId: string) => void;
  selectedDeviceSpecWidth: number | undefined;
  selectedElementFontOptions: string[];
  selectedSlotBackground: TemplateBackground;
  selectedSlotData: Slot | null;
  selectedTemplateElement: TemplateElement | null;
  setSelectedTemplateElementId: (elementId: string) => void;
  templateElements: TemplateElement[];
  updateTemplateBackground: (patch: Partial<TemplateBackground>) => void;
  updateTemplateElement: (elementId: string, mutator: (element: TemplateElement) => TemplateElement) => void;
}

export function TemplateInspectorSection({
  addTemplateElement,
  openTemplateImagePicker,
  removeTemplateElement,
  selectedDeviceSpecWidth,
  selectedElementFontOptions,
  selectedSlotBackground,
  selectedSlotData,
  selectedTemplateElement,
  setSelectedTemplateElementId,
  templateElements,
  updateTemplateBackground,
  updateTemplateElement
}: TemplateInspectorSectionProps) {
    let selectedElementInspector: ReactNode = null;

    if (selectedTemplateElement?.kind === 'text') {
      const textElement = selectedTemplateElement;
      selectedElementInspector = (
        <>
          <LabeledField label="Text Source">
            <Select
              value={textElement.textSource}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, textSource: value as TemplateTextSource } : current
              ))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="title">slot title</SelectItem>
                <SelectItem value="subtitle">slot subtitle</SelectItem>
                <SelectItem value="custom">custom text</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>

          {textElement.textSource === 'custom' ? (
            <LabeledField label="Custom Text">
              <Textarea
                value={textElement.customText}
                onChange={(event) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' ? { ...current, customText: event.target.value } : current
                ))}
                className="min-h-[96px]"
              />
            </LabeledField>
          ) : null}

          <SwitchRow
            label="Auto Size (Text Wrap)"
            checked={textElement.autoSize}
            onCheckedChange={(checked) => updateTemplateElement(textElement.id, (current) => (
              current.kind === 'text' ? { ...current, autoSize: checked } : current
            ))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Font">
              <FontSelector
                value={textElement.font}
                options={selectedElementFontOptions}
                onChange={(value) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' && current.font !== value ? { ...current, font: value } : current
                ))}
              />
            </LabeledField>
            <NumberField
              label="Size"
              value={textElement.size}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, size: value } : current
              ))}
            />
            <NumberField
              label="Line Height"
              value={textElement.lineHeight}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, lineHeight: Math.max(0.5, value || 1) } : current
              ))}
            />
            <NumberField
              label="Weight"
              value={textElement.weight}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, weight: value } : current
              ))}
            />
            <LabeledField label="Align">
              <Select
                value={textElement.align}
                onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                  current.kind === 'text' ? { ...current, align: value as Align } : current
                ))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">left</SelectItem>
                  <SelectItem value="center">center</SelectItem>
                  <SelectItem value="right">right</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>
            <ColorField
              label="Text Color"
              value={textElement.color}
              fallbackColor="#f9fafb"
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, color: value } : current
              ))}
            />
            <ColorField
              label="Background Color"
              value={textElement.backgroundColor}
              fallbackColor="#111827"
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, backgroundColor: value } : current
              ))}
            />
            <NumberField
              label="Padding"
              value={textElement.padding}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, padding: value } : current
              ))}
            />
            <NumberField
              label="Corner Radius"
              value={textElement.cornerRadius}
              onValueChange={(value) => updateTemplateElement(textElement.id, (current) => (
                current.kind === 'text' ? { ...current, cornerRadius: value } : current
              ))}
            />
          </div>
        </>
      );
    } else if (selectedTemplateElement?.kind === 'image') {
      const imageElement = selectedTemplateElement;
      selectedElementInspector = (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Mode">
              <div className="space-y-2">
                <Select
                  value={imageElement.source}
                  onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                    current.kind === 'image'
                      ? {
                        ...current,
                        source: value as 'image' | 'color'
                      }
                      : current
                  ))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="color">Color fill</SelectItem>
                  </SelectContent>
                </Select>

                {imageElement.source === 'image' ? (
                  <>
                    <p className="rounded-md border bg-muted/60 p-2 text-xs">
                      {imageElement.imagePath ? 'Image selected' : 'No image selected'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTemplateImagePicker(imageElement.id)}
                    >
                      Choose Image
                    </Button>
                  </>
                ) : (
                  <ColorField
                    label="Fill Color"
                    value={imageElement.fillColor}
                    fallbackColor="#111827"
                    onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                      current.kind === 'image' ? { ...current, fillColor: value } : current
                    ))}
                  />
                )}
              </div>
            </LabeledField>
            {imageElement.source === 'image' ? (
              <LabeledField label="Fit">
                <Select
                  value={imageElement.fit}
                  onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                    current.kind === 'image' ? { ...current, fit: value as 'cover' | 'contain' } : current
                  ))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">cover</SelectItem>
                    <SelectItem value="contain">contain</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledField>
            ) : null}
            <NumberField
              label="Corner Radius"
              value={imageElement.cornerRadius}
              onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                current.kind === 'image' ? { ...current, cornerRadius: value } : current
              ))}
            />
          </div>

          <SwitchRow
            label="Device Frame (Image only)"
            checked={imageElement.deviceFrame}
            onCheckedChange={(checked) => updateTemplateElement(imageElement.id, (current) => (
              current.kind === 'image' ? { ...current, deviceFrame: checked } : current
            ))}
          />

          {imageElement.deviceFrame ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Frame Inset"
                value={imageElement.frameInset}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameInset: value } : current
                ))}
              />
              <NumberField
                label="Frame Radius"
                value={imageElement.frameRadius}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameRadius: value } : current
                ))}
              />
              <NumberField
                label="Frame Width"
                value={imageElement.frameWidth}
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameWidth: value } : current
                ))}
              />
              <ColorField
                label="Frame Color"
                value={imageElement.frameColor}
                fallbackColor="#ffffff"
                onValueChange={(value) => updateTemplateElement(imageElement.id, (current) => (
                  current.kind === 'image' ? { ...current, frameColor: value } : current
                ))}
              />
            </div>
          ) : null}
        </>
      );
    }

    const inspectorSlotWidth = Math.max(1, selectedDeviceSpecWidth || 1290);
    const leftAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('left', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const centerAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('center', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const rightAlignedX = selectedTemplateElement
      ? resolveHorizontalAlignedX('right', inspectorSlotWidth, selectedTemplateElement.w)
      : 0;
    const horizontalAlignedState: Align | null = selectedTemplateElement
      ? Math.abs(selectedTemplateElement.x - leftAlignedX) <= 1
        ? 'left'
        : Math.abs(selectedTemplateElement.x - centerAlignedX) <= 1
          ? 'center'
          : Math.abs(selectedTemplateElement.x - rightAlignedX) <= 1
            ? 'right'
            : null
      : null;

    return (
      <>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Background</CardTitle>
            <CardDescription>
              {selectedSlotData ? `${selectedSlotData.id} 배경 설정` : '슬롯별 배경 설정'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledField label="Background Type">
              <Select
                value={selectedSlotBackground.type}
                onValueChange={(value) => updateTemplateBackground({ type: value as 'solid' | 'gradient' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">solid</SelectItem>
                  <SelectItem value="gradient">gradient</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            {selectedSlotBackground.type === 'solid' ? (
              <ColorField
                label="Color"
                value={selectedSlotBackground.value || '#111827'}
                fallbackColor="#111827"
                onValueChange={(value) => updateTemplateBackground({ value })}
              />
            ) : (
              <>
                <ColorField
                  label="From"
                  value={selectedSlotBackground.from || '#111827'}
                  fallbackColor="#111827"
                  onValueChange={(value) => updateTemplateBackground({ from: value })}
                />
                <ColorField
                  label="To"
                  value={selectedSlotBackground.to || '#1f2937'}
                  fallbackColor="#1f2937"
                  onValueChange={(value) => updateTemplateBackground({ to: value })}
                />
                <LabeledField label="Direction">
                  <Input value={selectedSlotBackground.direction || '180deg'} onChange={(event) => updateTemplateBackground({ direction: event.target.value })} />
                </LabeledField>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Layers</CardTitle>
            <CardDescription>선택한 슬롯에만 적용되는 텍스트/이미지 요소를 편집합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addTemplateElement('text')}>
                <Plus className="mr-1 h-4 w-4" />Add Text
              </Button>
              <Button size="sm" variant="outline" onClick={() => addTemplateElement('image')}>
                <Plus className="mr-1 h-4 w-4" />Add Image
              </Button>
            </div>

            <div className="space-y-2">
              {templateElements.map((element) => (
                <div key={element.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-left text-sm ${selectedTemplateElement?.id === element.id ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    onClick={() => setSelectedTemplateElementId(element.id)}
                  >
                    <span className="font-medium">{element.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{element.kind}</span>
                  </button>
                  <Button size="sm" variant="destructive" disabled={templateElements.length <= 1} onClick={() => removeTemplateElement(element.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedTemplateElement ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Element Inspector</CardTitle>
              <CardDescription>{selectedTemplateElement.name} · {selectedTemplateElement.kind}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LabeledField label="Element Name">
                <Input
                  value={selectedTemplateElement.name}
                  onChange={(event) => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                    ...current,
                    name: event.target.value
                  }))}
                />
              </LabeledField>

              <LabeledField label="Horizontal Align">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'left' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('left', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Left
                  </Button>
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'center' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('center', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Center
                  </Button>
                  <Button
                    size="sm"
                    variant={horizontalAlignedState === 'right' ? 'secondary' : 'outline'}
                    onClick={() => updateTemplateElement(selectedTemplateElement.id, (current) => ({
                      ...current,
                      x: resolveHorizontalAlignedX('right', inspectorSlotWidth, current.w)
                    }))}
                  >
                    Right
                  </Button>
                </div>
              </LabeledField>

              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="X"
                  value={selectedTemplateElement.x}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => {
                    if (current.kind === 'text') {
                      const slotWidth = Math.max(1, selectedDeviceSpecWidth || 1290);
                      const textWidth = resolveTextWidthFromPercent(current.widthPercent, slotWidth);
                      return {
                        ...current,
                        x: clampNumber(value, 0, Math.max(0, slotWidth - textWidth))
                      };
                    }
                    return { ...current, x: value };
                  })}
                />
                <NumberField
                  label="Y"
                  value={selectedTemplateElement.y}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, y: value }))}
                />
                <NumberField
                  label={selectedTemplateElement.kind === 'text' ? 'Width (%)' : 'Width'}
                  value={selectedTemplateElement.kind === 'text' ? selectedTemplateElement.widthPercent : selectedTemplateElement.w}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => {
                    if (current.kind === 'text') {
                      const slotWidth = Math.max(1, selectedDeviceSpecWidth || 1290);
                      const widthPercent = clampTextWidthPercent(value);
                      const textWidth = resolveTextWidthFromPercent(widthPercent, slotWidth);
                      const centeredX = Math.round((slotWidth - textWidth) / 2);
                      return {
                        ...current,
                        widthPercent,
                        w: textWidth,
                        x: clampNumber(centeredX, 0, Math.max(0, slotWidth - textWidth))
                      };
                    }
                    return { ...current, w: value };
                  })}
                />
                <NumberField
                  label="Height"
                  value={selectedTemplateElement.h}
                  disabled={selectedTemplateElement.kind === 'text' && selectedTemplateElement.autoSize}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, h: value }))}
                />
                <NumberField
                  label="Opacity"
                  value={selectedTemplateElement.opacity}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, opacity: value }))}
                />
                <NumberField
                  label="Rotation"
                  value={selectedTemplateElement.rotation}
                  onValueChange={(value) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, rotation: value }))}
                />
              </div>

              <SwitchRow
                label="Visible"
                checked={selectedTemplateElement.visible}
                onCheckedChange={(checked) => updateTemplateElement(selectedTemplateElement.id, (current) => ({ ...current, visible: checked }))}
              />

              {selectedElementInspector}
            </CardContent>
          </Card>
        ) : null}
      </>
    );
}
