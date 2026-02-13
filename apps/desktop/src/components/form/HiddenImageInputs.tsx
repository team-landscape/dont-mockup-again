import type { ChangeEvent, RefObject } from 'react';

interface HiddenImageInputsProps {
  slotImageInputRef: RefObject<HTMLInputElement>;
  templateImageInputRef: RefObject<HTMLInputElement>;
  onSlotImageFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTemplateImageFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function HiddenImageInputs({
  slotImageInputRef,
  templateImageInputRef,
  onSlotImageFileChange,
  onTemplateImageFileChange
}: HiddenImageInputsProps) {
  return (
    <>
      <input
        ref={slotImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => { void onSlotImageFileChange(event); }}
      />

      <input
        ref={templateImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => { void onTemplateImageFileChange(event); }}
      />
    </>
  );
}
