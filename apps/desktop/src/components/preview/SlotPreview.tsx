import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';

import {
  clampNumber,
  getSlotPreviewCanvasSize,
  globalTemplateImageKey,
  slotTemplateImageKey,
  TEMPLATE_REFERENCE_WIDTH,
  type Device,
  type TemplateElement,
  type TemplateMain
} from '../../lib/project-model';
import {
  drawCheckerPattern,
  drawRoundedRectPath,
  drawTextBlock,
  loadPreviewImage,
  resolvePreviewLayer
} from '../../lib/preview-rendering';

export interface SlotCardProps {
  slot: { id: string };
  titleValue: string;
  subtitleValue: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  template: TemplateMain;
  templateImageUrls: Record<string, string>;
  device: Device;
  onSelect: (slotId: string) => void;
  editable: boolean;
  selectedElementId: string;
  onSelectElement: (elementId: string) => void;
  onMoveElement: (elementId: string, x: number, y: number) => void;
}

function isSameTemplatePreviewState(prev: TemplateMain, next: TemplateMain) {
  if (prev.elements !== next.elements) return false;

  const prevBg = prev.background;
  const nextBg = next.background;
  return prevBg.type === nextBg.type
    && prevBg.value === nextBg.value
    && prevBg.from === nextBg.from
    && prevBg.to === nextBg.to
    && prevBg.direction === nextBg.direction;
}

export const SlotCard = memo(function SlotCard({
  slot,
  titleValue,
  subtitleValue,
  renderedPreviewUrl,
  sourceImageUrl,
  template,
  templateImageUrls,
  device,
  onSelect,
  editable,
  selectedElementId,
  onSelectElement,
  onMoveElement
}: SlotCardProps) {
  return (
    <button
      className="block bg-transparent p-0"
      onClick={() => onSelect(slot.id)}
      type="button"
    >
      <SlotRenderPreview
        slotId={slot.id}
        title={titleValue}
        subtitle={subtitleValue}
        renderedPreviewUrl={renderedPreviewUrl}
        sourceImageUrl={sourceImageUrl}
        template={template}
        templateImageUrls={templateImageUrls}
        device={device}
        scaleImageToDevice
        editable={editable}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onMoveElement={onMoveElement}
      />
    </button>
  );
}, (prev, next) => (
  prev.slot === next.slot
  && prev.titleValue === next.titleValue
  && prev.subtitleValue === next.subtitleValue
  && prev.renderedPreviewUrl === next.renderedPreviewUrl
  && prev.sourceImageUrl === next.sourceImageUrl
  && isSameTemplatePreviewState(prev.template, next.template)
  && prev.templateImageUrls === next.templateImageUrls
  && prev.device === next.device
  && prev.onSelect === next.onSelect
  && prev.editable === next.editable
  && prev.selectedElementId === next.selectedElementId
  && prev.onSelectElement === next.onSelectElement
  && prev.onMoveElement === next.onMoveElement
));

interface SlotRenderPreviewProps {
  slotId: string;
  title: string;
  subtitle: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  template: TemplateMain;
  templateImageUrls: Record<string, string>;
  device: Device;
  scaleImageToDevice?: boolean;
  editable?: boolean;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onMoveElement?: (elementId: string, x: number, y: number) => void;
}

export async function renderTemplatePreviewBase64(params: {
  slotId: string;
  title: string;
  subtitle: string;
  template: TemplateMain;
  templateImageUrls: Record<string, string>;
  device: Device;
}) {
  if (typeof document === 'undefined') {
    throw new Error('Preview renderer is unavailable outside browser runtime.');
  }

  const { slotId, title, subtitle, template, templateImageUrls, device } = params;
  const width = Math.max(1, device.width || 1290);
  const height = Math.max(1, device.height || 2796);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create canvas context.');
  }

  const visibleLayers = [...template.elements]
    .filter((item) => item.visible !== false)
    .sort((a, b) => a.z - b.z);
  const previewLayers = visibleLayers.map((layer) => resolvePreviewLayer(context, layer, title, subtitle, width, height, {
    scaleImageToDevice: true,
    scaleTextToDevice: true
  }));

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);

  if (template.background.type === 'gradient') {
    const parsed = Number.parseFloat(template.background.direction || '180');
    const degrees = Number.isFinite(parsed) ? parsed : 180;
    const radians = (degrees * Math.PI) / 180;
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);
    const x1 = width / 2 - dx * width / 2;
    const y1 = height / 2 - dy * height / 2;
    const x2 = width / 2 + dx * width / 2;
    const y2 = height / 2 + dy * height / 2;
    const gradient = context.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, template.background.from || '#111827');
    gradient.addColorStop(1, template.background.to || '#030712');
    context.fillStyle = gradient;
  } else {
    context.fillStyle = template.background.value || '#111827';
  }
  context.fillRect(0, 0, width, height);

  for (const activeLayer of previewLayers) {
    const opacity = clampNumber(activeLayer.opacity, 0, 100) / 100;
    const centerX = activeLayer.x + activeLayer.w / 2;
    const centerY = activeLayer.y + activeLayer.h / 2;
    const radians = (activeLayer.rotation * Math.PI) / 180;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(radians);
    context.translate(-centerX, -centerY);
    context.globalAlpha = context.globalAlpha * opacity;

    if (activeLayer.kind === 'text') {
      const textValue = activeLayer.textSource === 'title'
        ? title
        : activeLayer.textSource === 'subtitle'
          ? subtitle
          : activeLayer.customText;
      drawTextBlock(context, activeLayer, textValue);
      context.restore();
      continue;
    }

    context.save();
    drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
    context.fillStyle = activeLayer.source === 'color'
      ? (activeLayer.fillColor || '#111827')
      : 'rgba(15,23,42,0.7)';
    context.fill();
    context.restore();

    if (activeLayer.source === 'color') {
      context.restore();
      continue;
    }

    const imageSource = templateImageUrls[slotTemplateImageKey(slotId, activeLayer.id)]
      || templateImageUrls[globalTemplateImageKey(activeLayer.id)];

    if (imageSource) {
      try {
        const image = await loadPreviewImage(imageSource);
        const imageWidth = Math.max(1, image.naturalWidth || image.width);
        const imageHeight = Math.max(1, image.naturalHeight || image.height);
        const scale = activeLayer.fit === 'contain'
          ? Math.min(activeLayer.w / imageWidth, activeLayer.h / imageHeight)
          : Math.max(activeLayer.w / imageWidth, activeLayer.h / imageHeight);
        const drawWidth = imageWidth * scale;
        const drawHeight = imageHeight * scale;
        const drawX = activeLayer.x + (activeLayer.w - drawWidth) / 2;
        const drawY = activeLayer.y + (activeLayer.h - drawHeight) / 2;

        context.save();
        drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
        context.clip();
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        context.restore();
      } catch {
        drawCheckerPattern(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, 28);
      }
    } else {
      context.save();
      drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
      context.clip();
      drawCheckerPattern(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, 28);
      context.restore();

      context.save();
      context.fillStyle = '#475569';
      context.font = `${Math.max(20, Math.round(width * 0.024))}px "SF Pro", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Choose image', activeLayer.x + activeLayer.w / 2, activeLayer.y + activeLayer.h / 2);
      context.restore();
    }

    if (activeLayer.deviceFrame) {
      const frameX = activeLayer.x + activeLayer.frameInset;
      const frameY = activeLayer.y + activeLayer.frameInset;
      const frameW = Math.max(0, activeLayer.w - activeLayer.frameInset * 2);
      const frameH = Math.max(0, activeLayer.h - activeLayer.frameInset * 2);
      if (frameW > 0 && frameH > 0) {
        context.save();
        drawRoundedRectPath(context, frameX, frameY, frameW, frameH, activeLayer.frameRadius);
        context.lineWidth = activeLayer.frameWidth;
        context.strokeStyle = activeLayer.frameColor || '#ffffff';
        context.stroke();
        context.restore();
      }
    }

    context.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1] || '';
}

export const SlotRenderPreview = memo(function SlotRenderPreview({
  slotId,
  title,
  subtitle,
  renderedPreviewUrl,
  sourceImageUrl,
  template,
  templateImageUrls,
  device,
  scaleImageToDevice = false,
  editable = false,
  selectedElementId,
  onSelectElement,
  onMoveElement
}: SlotRenderPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const layerDragRef = useRef<{
    pointerId: number;
    elementId: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    elementW: number;
    elementH: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const [dragLayerPosition, setDragLayerPosition] = useState<{
    elementId: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const width = Math.max(1, device.width || 1290);
  const height = Math.max(1, device.height || 2796);
  const previewToTemplateScale = useMemo(() => {
    if (!scaleImageToDevice) return 1;
    return Math.max(0.0001, width / TEMPLATE_REFERENCE_WIDTH);
  }, [scaleImageToDevice, width]);
  const previewSize = useMemo(
    () => getSlotPreviewCanvasSize(device),
    [device.height, device.width]
  );
  const editableLayers = useMemo(
    () => [...template.elements]
      .filter((item) => item.visible !== false)
      .sort((a, b) => a.z - b.z),
    [template.elements]
  );
  const previewLayers = useMemo(() => {
    if (typeof document === 'undefined') {
      return editableLayers;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return editableLayers;
    }

    return editableLayers.map((layer) => resolvePreviewLayer(context, layer, title, subtitle, width, height, {
      scaleImageToDevice,
      scaleTextToDevice: scaleImageToDevice
    }));
  }, [editableLayers, height, scaleImageToDevice, subtitle, title, width]);

  const handleLayerPointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    layer: TemplateElement
  ) => {
    if (!editable || !onMoveElement || !onSelectElement) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const scaleX = rect.width > 0 ? rect.width / width : 1;
    const scaleY = rect.height > 0 ? rect.height / height : 1;

    onSelectElement(layer.id);
    setDragLayerPosition({
      elementId: layer.id,
      x: layer.x,
      y: layer.y,
      originX: layer.x,
      originY: layer.y
    });
    layerDragRef.current = {
      pointerId: event.pointerId,
      elementId: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: layer.x,
      originY: layer.y,
      elementW: layer.w,
      elementH: layer.h,
      scaleX,
      scaleY
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }, [editable, height, onMoveElement, onSelectElement, width]);

  const handleLayerPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = layerDragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const nextX = clampNumber(
      state.originX + ((event.clientX - state.startClientX) / Math.max(0.001, state.scaleX)),
      0,
      Math.max(0, width - state.elementW)
    );
    const nextY = clampNumber(
      state.originY + ((event.clientY - state.startClientY) / Math.max(0.001, state.scaleY)),
      0,
      Math.max(0, height - state.elementH)
    );

    setDragLayerPosition((current) => {
      if (!current || current.elementId !== state.elementId) {
        return {
          elementId: state.elementId,
          x: nextX,
          y: nextY,
          originX: state.originX,
          originY: state.originY
        };
      }

      if (Math.abs(current.x - nextX) < 0.01 && Math.abs(current.y - nextY) < 0.01) {
        return current;
      }

      return {
        ...current,
        x: nextX,
        y: nextY
      };
    });

    event.stopPropagation();
    event.preventDefault();
  }, [height, width]);

  const handleLayerPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = layerDragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const finalX = dragLayerPosition?.elementId === state.elementId ? dragLayerPosition.x : state.originX;
    const finalY = dragLayerPosition?.elementId === state.elementId ? dragLayerPosition.y : state.originY;
    const finalRoundedX = Math.round(finalX);
    const finalRoundedY = Math.round(finalY);
    const moved = Math.abs(finalRoundedX - state.originX) >= 0.01 || Math.abs(finalRoundedY - state.originY) >= 0.01;

    if (moved) {
      setDragLayerPosition((current) => {
        if (current && current.elementId === state.elementId) {
          return {
            ...current,
            x: finalRoundedX,
            y: finalRoundedY
          };
        }

        return {
          elementId: state.elementId,
          x: finalRoundedX,
          y: finalRoundedY,
          originX: state.originX,
          originY: state.originY
        };
      });
      if (onMoveElement) {
        const templateX = Math.round(finalRoundedX / previewToTemplateScale);
        const templateY = Math.round(finalRoundedY / previewToTemplateScale);
        onMoveElement(state.elementId, templateX, templateY);
      }
    } else {
      setDragLayerPosition(null);
    }

    layerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
    event.preventDefault();
  }, [dragLayerPosition, onMoveElement, previewToTemplateScale]);

  const selectLayerAtClientPoint = useCallback((clientX: number, clientY: number) => {
    if (!editable || !onSelectElement) return false;
    const overlay = overlayRef.current;
    if (!overlay) return false;

    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) {
      return false;
    }

    const worldX = (relativeX / rect.width) * width;
    const worldY = (relativeY / rect.height) * height;

    for (let index = previewLayers.length - 1; index >= 0; index -= 1) {
      const layer = previewLayers[index];
      if (
        worldX >= layer.x
        && worldX <= layer.x + layer.w
        && worldY >= layer.y
        && worldY <= layer.y + layer.h
      ) {
        onSelectElement(layer.id);
        return true;
      }
    }

    return false;
  }, [editable, height, onSelectElement, previewLayers, width]);

  const handlePreviewDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const selected = selectLayerAtClientPoint(event.clientX, event.clientY);
    if (!selected) return;

    event.stopPropagation();
    event.preventDefault();
  }, [selectLayerAtClientPoint]);

  useEffect(() => {
    if (!dragLayerPosition) return;
    if (layerDragRef.current) return;

    const layer = previewLayers.find((entry) => entry.id === dragLayerPosition.elementId);
    if (!layer) {
      setDragLayerPosition(null);
      return;
    }

    const isSynced = Math.abs(layer.x - dragLayerPosition.x) < 0.01
      && Math.abs(layer.y - dragLayerPosition.y) < 0.01;
    if (isSynced) {
      setDragLayerPosition(null);
    }
  }, [dragLayerPosition, previewLayers]);

  useEffect(() => {
    let cancelled = false;

    async function drawToCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderScale = previewSize.renderScale;
      const canvasWidth = previewSize.width;
      const canvasHeight = previewSize.height;
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(renderScale, renderScale);

      if (template.background.type === 'gradient') {
        const parsed = Number.parseFloat(template.background.direction || '180');
        const degrees = Number.isFinite(parsed) ? parsed : 180;
        const radians = (degrees * Math.PI) / 180;
        const dx = Math.sin(radians);
        const dy = -Math.cos(radians);
        const x1 = width / 2 - dx * width / 2;
        const y1 = height / 2 - dy * height / 2;
        const x2 = width / 2 + dx * width / 2;
        const y2 = height / 2 + dy * height / 2;
        const gradient = context.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, template.background.from || '#111827');
        gradient.addColorStop(1, template.background.to || '#030712');
        context.fillStyle = gradient;
      } else {
        context.fillStyle = template.background.value || '#111827';
      }
      context.fillRect(0, 0, width, height);

      for (const layer of previewLayers) {
        const activeLayer = dragLayerPosition?.elementId === layer.id
          ? {
            ...layer,
            x: dragLayerPosition.x,
            y: dragLayerPosition.y
          }
          : layer;
        const opacity = clampNumber(activeLayer.opacity, 0, 100) / 100;
        const centerX = activeLayer.x + activeLayer.w / 2;
        const centerY = activeLayer.y + activeLayer.h / 2;
        const radians = (activeLayer.rotation * Math.PI) / 180;

        context.save();
        context.translate(centerX, centerY);
        context.rotate(radians);
        context.translate(-centerX, -centerY);
        context.globalAlpha = context.globalAlpha * opacity;

        if (activeLayer.kind === 'text') {
          const textValue = activeLayer.textSource === 'title'
            ? title
            : activeLayer.textSource === 'subtitle'
              ? subtitle
              : activeLayer.customText;
          drawTextBlock(context, activeLayer, textValue);
          context.restore();
          continue;
        }

        context.save();
        drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
        context.fillStyle = activeLayer.source === 'color'
          ? (activeLayer.fillColor || '#111827')
          : 'rgba(15,23,42,0.7)';
        context.fill();
        context.restore();

        if (activeLayer.source === 'color') {
          context.restore();
          continue;
        }

        const imageSource = templateImageUrls[slotTemplateImageKey(slotId, activeLayer.id)]
          || templateImageUrls[globalTemplateImageKey(activeLayer.id)];

        if (imageSource) {
          try {
            const image = await loadPreviewImage(imageSource);
            if (cancelled) return;

            const imageWidth = Math.max(1, image.naturalWidth || image.width);
            const imageHeight = Math.max(1, image.naturalHeight || image.height);
            const scale = activeLayer.fit === 'contain'
              ? Math.min(activeLayer.w / imageWidth, activeLayer.h / imageHeight)
              : Math.max(activeLayer.w / imageWidth, activeLayer.h / imageHeight);
            const drawWidth = imageWidth * scale;
            const drawHeight = imageHeight * scale;
            const drawX = activeLayer.x + (activeLayer.w - drawWidth) / 2;
            const drawY = activeLayer.y + (activeLayer.h - drawHeight) / 2;

            context.save();
            drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
            context.clip();
            context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
            context.restore();
          } catch {
            drawCheckerPattern(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, 28);
          }
        } else {
          context.save();
          drawRoundedRectPath(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, activeLayer.cornerRadius || 0);
          context.clip();
          drawCheckerPattern(context, activeLayer.x, activeLayer.y, activeLayer.w, activeLayer.h, 28);
          context.restore();

          context.save();
          context.fillStyle = '#475569';
          context.font = `${Math.max(20, Math.round(width * 0.024))}px "SF Pro", sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          const missingMessage = 'Choose image';
          context.fillText(missingMessage, activeLayer.x + activeLayer.w / 2, activeLayer.y + activeLayer.h / 2);
          context.restore();
        }

        if (activeLayer.deviceFrame) {
          const frameX = activeLayer.x + activeLayer.frameInset;
          const frameY = activeLayer.y + activeLayer.frameInset;
          const frameW = Math.max(0, activeLayer.w - activeLayer.frameInset * 2);
          const frameH = Math.max(0, activeLayer.h - activeLayer.frameInset * 2);
          if (frameW > 0 && frameH > 0) {
            context.save();
            drawRoundedRectPath(context, frameX, frameY, frameW, frameH, activeLayer.frameRadius);
            context.lineWidth = activeLayer.frameWidth;
            context.strokeStyle = activeLayer.frameColor || '#ffffff';
            context.stroke();
            context.restore();
          }
        }

        context.restore();
      }
    }

    void drawToCanvas();
    return () => {
      cancelled = true;
    };
  }, [dragLayerPosition, height, previewLayers, previewSize.height, previewSize.renderScale, previewSize.width, renderedPreviewUrl, sourceImageUrl, templateImageUrls, width]);

  useEffect(() => {
    return () => {
      layerDragRef.current = null;
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="relative w-full"
      style={{ maxWidth: `${previewSize.width}px`, aspectRatio: `${previewSize.width} / ${previewSize.height}` }}
      onDoubleClick={handlePreviewDoubleClick}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        role="img"
        aria-label={`${slotId} live preview`}
      />

      {editable ? (
        <div className="pointer-events-none absolute inset-0">
          {previewLayers
            .filter((layer) => layer.id === selectedElementId)
            .map((layer) => {
              const currentX = dragLayerPosition?.elementId === layer.id ? dragLayerPosition.x : layer.x;
              const currentY = dragLayerPosition?.elementId === layer.id ? dragLayerPosition.y : layer.y;

              return (
                <div
                  key={layer.id}
                  className="pointer-events-auto absolute cursor-move border border-primary bg-transparent shadow-[0_0_0_1px_rgba(14,165,233,0.45)]"
                  style={{
                    left: `${(currentX / width) * 100}%`,
                    top: `${(currentY / height) * 100}%`,
                    width: `${(layer.w / width) * 100}%`,
                    height: `${(layer.h / height) * 100}%`,
                    transform: `rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center'
                  }}
                  onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerEnd}
                  onPointerCancel={handleLayerPointerEnd}
                />
              );
            })}
        </div>
      ) : null}
    </div>
  );
});
