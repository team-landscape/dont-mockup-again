import { useCallback, type MutableRefObject, type TransitionStartFunction } from 'react';

import {
  type ProjectDoc,
  type TemplateElement,
  type TemplateElementKind,
  type TemplateImageElement,
  type TemplateMain,
  type TemplateTextElement,
  clampNumber,
  clone,
  cloneTemplateElements,
  normalizeTemplateElementOrder,
  resolveTemplateElementsForSlot,
  resolveTextWidthFromPercent,
  syncTemplateLegacyFields
} from '../lib/project-model';

interface UseTemplateEditorActionsArgs {
  setDoc: (value: ProjectDoc | ((current: ProjectDoc) => ProjectDoc)) => void;
  startTemplateTransition: TransitionStartFunction;
  selectedSlot: string;
  selectedSlotDataId?: string;
  selectedDeviceWidth: number;
  availableFonts: string[];
  templateImageInputRef: MutableRefObject<HTMLInputElement | null>;
  templateImageTargetRef: MutableRefObject<string | null>;
  setSelectedTemplateElementId: (value: string) => void;
}

export function useTemplateEditorActions({
  setDoc,
  startTemplateTransition,
  selectedSlot,
  selectedSlotDataId,
  selectedDeviceWidth,
  availableFonts,
  templateImageInputRef,
  templateImageTargetRef,
  setSelectedTemplateElementId
}: UseTemplateEditorActionsArgs) {
  const selectedTemplateSlotId = selectedSlotDataId || selectedSlot;

  const updateTemplateMain = useCallback((mutator: (main: TemplateMain) => void) => {
    const slotWidth = Math.max(1, selectedDeviceWidth || 1290);
    startTemplateTransition(() => {
      setDoc((current) => {
        const nextMain = clone(current.template.main);
        mutator(nextMain);

        return {
          ...current,
          template: {
            ...current.template,
            main: syncTemplateLegacyFields(nextMain, slotWidth)
          }
        };
      });
    });
  }, [selectedDeviceWidth, setDoc, startTemplateTransition]);

  const updateTemplateBackground = useCallback((patch: Partial<TemplateMain['background']>) => {
    updateTemplateMain((main) => {
      const current = main.slotBackgrounds[selectedTemplateSlotId] || main.background;
      main.slotBackgrounds[selectedTemplateSlotId] = {
        ...current,
        ...patch
      };
    });
  }, [selectedTemplateSlotId, updateTemplateMain]);

  const updateTemplateElement = useCallback((elementId: string, mutator: (element: TemplateElement) => TemplateElement) => {
    updateTemplateMain((main) => {
      const sourceElements = resolveTemplateElementsForSlot(main, selectedTemplateSlotId);
      const index = sourceElements.findIndex((item) => item.id === elementId);
      if (index < 0) return;
      const nextElements = cloneTemplateElements(sourceElements);
      nextElements[index] = mutator(nextElements[index]);
      main.slotElements[selectedTemplateSlotId] = normalizeTemplateElementOrder(nextElements);
    });
  }, [selectedTemplateSlotId, updateTemplateMain]);

  const moveTemplateElement = useCallback((elementId: string, x: number, y: number) => {
    const slotWidth = Math.max(1, selectedDeviceWidth || 1290);
    updateTemplateElement(elementId, (current) => {
      const nextXRaw = Math.round(x);
      const nextY = Math.round(y);
      const nextX = current.kind === 'text'
        ? clampNumber(nextXRaw, 0, Math.max(0, slotWidth - resolveTextWidthFromPercent(current.widthPercent, slotWidth)))
        : nextXRaw;
      if (current.x === nextX && current.y === nextY) {
        return current;
      }

      return {
        ...current,
        x: nextX,
        y: nextY
      };
    });
  }, [selectedDeviceWidth, updateTemplateElement]);

  const addTemplateElement = useCallback((kind: TemplateElementKind) => {
    let createdId = '';

    updateTemplateMain((main) => {
      const sourceElements = resolveTemplateElementsForSlot(main, selectedTemplateSlotId);
      const slotElements = cloneTemplateElements(sourceElements);
      const existingIds = new Set(slotElements.map((item) => item.id));
      let nextNumber = 1;
      while (existingIds.has(`${kind}-${nextNumber}`)) {
        nextNumber += 1;
      }
      createdId = `${kind}-${nextNumber}`;

      const topZ = slotElements.reduce((max, item) => Math.max(max, item.z), 0);
      if (kind === 'text') {
        const slotWidth = Math.max(1, selectedDeviceWidth || 1290);
        const newTextElement: TemplateTextElement = {
          id: createdId,
          name: `Text ${nextNumber}`,
          kind: 'text',
          x: 0,
          y: 120,
          w: slotWidth,
          h: 200,
          z: topZ + 10,
          visible: true,
          opacity: 100,
          rotation: 0,
          textSource: 'custom',
          customText: 'New text',
          font: availableFonts[0] || 'SF Pro',
          size: 64,
          lineHeight: 1.2,
          weight: 700,
          align: 'center',
          autoSize: true,
          widthPercent: 100,
          color: '#f9fafb',
          backgroundColor: 'transparent',
          padding: 0,
          cornerRadius: 0
        };
        slotElements.push(newTextElement);
        main.slotElements[selectedTemplateSlotId] = normalizeTemplateElementOrder(slotElements);
        return;
      }

      const newImageElement: TemplateImageElement = {
        id: createdId,
        name: `Image ${nextNumber}`,
        kind: 'image',
        x: 120,
        y: 560,
        w: 1000,
        h: 2000,
        z: topZ + 10,
        visible: true,
        opacity: 100,
        rotation: 0,
        source: 'image',
        imagePath: '',
        fillColor: '#111827',
        fit: 'cover',
        cornerRadius: 48,
        deviceFrame: false,
        frameInset: 0,
        frameRadius: 72,
        frameColor: '#ffffff',
        frameWidth: 3
      };
      slotElements.push(newImageElement);
      main.slotElements[selectedTemplateSlotId] = normalizeTemplateElementOrder(slotElements);
    });

    if (createdId) {
      setSelectedTemplateElementId(createdId);
    }
  }, [
    availableFonts,
    selectedDeviceWidth,
    selectedTemplateSlotId,
    setSelectedTemplateElementId,
    updateTemplateMain
  ]);

  const removeTemplateElement = useCallback((elementId: string) => {
    updateTemplateMain((main) => {
      const sourceElements = resolveTemplateElementsForSlot(main, selectedTemplateSlotId);
      if (sourceElements.length <= 1) return;

      const nextElements = sourceElements.filter((item) => item.id !== elementId);
      if (nextElements.length === sourceElements.length || nextElements.length === 0) return;

      main.slotElements[selectedTemplateSlotId] = normalizeTemplateElementOrder(cloneTemplateElements(nextElements));
    });
  }, [selectedTemplateSlotId, updateTemplateMain]);

  const openTemplateImagePicker = useCallback((elementId: string) => {
    templateImageTargetRef.current = elementId;
    templateImageInputRef.current?.click();
  }, [templateImageInputRef, templateImageTargetRef]);

  return {
    selectedTemplateSlotId,
    updateTemplateBackground,
    updateTemplateElement,
    moveTemplateElement,
    addTemplateElement,
    removeTemplateElement,
    openTemplateImagePicker
  };
}
