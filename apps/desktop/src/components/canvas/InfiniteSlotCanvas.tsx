import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SlotCard } from '../preview/SlotPreview';
import {
  type Device,
  type Slot,
  type SlotCanvasPosition,
  type TemplateMain,
  defaultSlotCanvasPosition,
  PINCH_ZOOM_ACCELERATION,
  resolveSlotCanvasPosition,
  SLOT_CANVAS_HEIGHT,
  SLOT_CANVAS_MAX_ZOOM,
  SLOT_CANVAS_MIN_ZOOM,
  SLOT_CANVAS_WIDTH
} from '../../lib/project-model';

export interface CanvasSlotItem {
  slot: Slot;
  titleValue: string;
  subtitleValue: string;
  renderedPreviewUrl?: string;
  sourceImageUrl?: string;
  template: TemplateMain;
}

interface InfiniteSlotCanvasProps {
  className?: string;
  focusTrigger?: number;
  items: CanvasSlotItem[];
  positions: Record<string, SlotCanvasPosition>;
  cardWidth: number;
  cardHeight: number;
  selectedSlot: string;
  templateImageUrls: Record<string, string>;
  device: Device;
  onSelect: (slotId: string) => void;
  onReorder: (slotId: string, targetIndex: number) => void;
  onRename: (slotId: string, nextName: string) => void;
  selectedTemplateElementId: string;
  onSelectTemplateElement: (elementId: string) => void;
  onMoveTemplateElement: (elementId: string, x: number, y: number) => void;
}

export const InfiniteSlotCanvas = memo(function InfiniteSlotCanvas({
  className,
  focusTrigger,
  items,
  positions,
  cardWidth,
  cardHeight,
  selectedSlot,
  templateImageUrls,
  device,
  onSelect,
  onReorder,
  onRename,
  selectedTemplateElementId,
  onSelectTemplateElement,
  onMoveTemplateElement
}: InfiniteSlotCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedSlotRef = useRef(selectedSlot);
  const zoomRef = useRef(1);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const dragRef = useRef<{
    slotId: string;
    pointerId: number;
    startIndex: number;
    lastTargetIndex: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ slotId: string; x: number; y: number } | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState('');
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const spacePanRef = useRef(false);
  const boardTransformRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const viewportOffsetRef = useRef<SlotCanvasPosition>({ x: 0, y: 0 });
  const transformFrameRef = useRef<number | null>(null);
  const focusAnimationFrameRef = useRef<number | null>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const pendingDragPreviewRef = useRef<{ slotId: string; x: number; y: number } | null>(null);
  const focusViewportOnSlotsRef = useRef<(behavior?: ScrollBehavior) => void>(() => {});
  const suppressNextSelectionCenterRef = useRef(false);

  const clampZoom = useCallback((value: number) => {
    return Math.min(SLOT_CANVAS_MAX_ZOOM, Math.max(SLOT_CANVAS_MIN_ZOOM, value));
  }, []);

  const boardStyle = useMemo<CSSProperties>(() => ({
    backgroundImage: [
      'linear-gradient(to right, rgba(100,116,139,0.16) 1px, transparent 1px)',
      'linear-gradient(to bottom, rgba(100,116,139,0.16) 1px, transparent 1px)',
      'linear-gradient(to right, rgba(71,85,105,0.28) 1px, transparent 1px)',
      'linear-gradient(to bottom, rgba(71,85,105,0.28) 1px, transparent 1px)'
    ].join(','),
    backgroundSize: '40px 40px, 40px 40px, 200px 200px, 200px 200px',
    backgroundPosition: '0 0, 0 0, 0 0, 0 0'
  }), []);

  const boardContentStyle = useMemo<CSSProperties>(() => ({
    ...boardStyle,
    width: SLOT_CANVAS_WIDTH,
    height: SLOT_CANVAS_HEIGHT
  }), [boardStyle]);

  const boardTransformStyle = useMemo<CSSProperties>(() => ({
    width: SLOT_CANVAS_WIDTH,
    height: SLOT_CANVAS_HEIGHT,
    transformOrigin: 'top left',
    transform: 'translate(0px, 0px) scale(1)',
    willChange: 'transform'
  }), []);

  const getViewportScrollBounds = useCallback((zoomValue: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return { maxX: 0, maxY: 0 };
    }

    return {
      maxX: Math.max(0, SLOT_CANVAS_WIDTH * zoomValue - viewport.clientWidth),
      maxY: Math.max(0, SLOT_CANVAS_HEIGHT * zoomValue - viewport.clientHeight)
    };
  }, []);

  const flushBoardTransform = useCallback(() => {
    transformFrameRef.current = null;
    const board = boardTransformRef.current;
    if (!board) return;

    const offset = viewportOffsetRef.current;
    const currentZoom = zoomRef.current;
    board.style.transform = `translate(${-offset.x}px, ${-offset.y}px) scale(${currentZoom})`;
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  }, []);

  const scheduleBoardTransform = useCallback(() => {
    if (transformFrameRef.current != null) return;
    transformFrameRef.current = window.requestAnimationFrame(flushBoardTransform);
  }, [flushBoardTransform]);

  const cancelFocusAnimation = useCallback(() => {
    if (focusAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(focusAnimationFrameRef.current);
      focusAnimationFrameRef.current = null;
    }
  }, []);

  const setViewportOffset = useCallback((x: number, y: number, zoomValue: number = zoomRef.current) => {
    const { maxX, maxY } = getViewportScrollBounds(zoomValue);
    const next: SlotCanvasPosition = {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    };

    viewportOffsetRef.current = next;
    scheduleBoardTransform();

    return next;
  }, [getViewportScrollBounds, scheduleBoardTransform]);

  useEffect(() => {
    scheduleBoardTransform();
    return () => {
      if (transformFrameRef.current != null) {
        window.cancelAnimationFrame(transformFrameRef.current);
        transformFrameRef.current = null;
      }
    };
  }, [scheduleBoardTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setViewportOffset(viewportOffsetRef.current.x, viewportOffsetRef.current.y, zoomRef.current);
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [setViewportOffset]);

  const focusViewportOnSlots = useCallback((behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport || items.length === 0) return;
    cancelFocusAnimation();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const [index, item] of items.entries()) {
      const position = resolveSlotCanvasPosition(positions, item.slot.id, index, cardWidth);
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + cardWidth);
      maxY = Math.max(maxY, position.y + cardHeight);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const centerX = ((minX + maxX) / 2) * zoomRef.current;
    const centerY = ((minY + maxY) / 2) * zoomRef.current;
    const targetX = centerX - viewport.clientWidth / 2;
    const targetY = centerY - viewport.clientHeight / 2;

    if (behavior === 'smooth') {
      const start = viewportOffsetRef.current;
      const deltaX = targetX - start.x;
      const deltaY = targetY - start.y;
      const startTime = performance.now();
      const duration = 180;

      const tick = (now: number) => {
        if (dragRef.current) {
          focusAnimationFrameRef.current = null;
          return;
        }
        const progress = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        setViewportOffset(start.x + deltaX * ease, start.y + deltaY * ease, zoomRef.current);
        if (progress < 1) {
          focusAnimationFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          focusAnimationFrameRef.current = null;
        }
      };

      focusAnimationFrameRef.current = window.requestAnimationFrame(tick);
      return;
    }

    if (dragRef.current) return;
    setViewportOffset(targetX, targetY, zoomRef.current);
  }, [cancelFocusAnimation, cardHeight, cardWidth, items, positions, setViewportOffset]);

  useEffect(() => {
    focusViewportOnSlotsRef.current = focusViewportOnSlots;
  }, [focusViewportOnSlots]);

  const applyZoomAtPoint = useCallback((nextZoomValue: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(nextZoomValue);
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const currentOffset = viewportOffsetRef.current;
    const worldX = (currentOffset.x + pointX) / currentZoom;
    const worldY = (currentOffset.y + pointY) / currentZoom;

    zoomRef.current = nextZoom;
    setViewportOffset(worldX * nextZoom - pointX, worldY * nextZoom - pointY, nextZoom);
  }, [clampZoom, setViewportOffset]);

  const pickViewportCenterAnchor = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
  }, []);

  const resolveWheelAnchor = useCallback((clientXInput: number, clientYInput: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const isInside = (x: number, y: number) => (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );

    let clientX = clientXInput;
    let clientY = clientYInput;

    if (!isInside(clientX, clientY) || (clientX === 0 && clientY === 0)) {
      const pointer = pointerRef.current;
      if (pointer && isInside(pointer.clientX, pointer.clientY)) {
        clientX = pointer.clientX;
        clientY = pointer.clientY;
      } else {
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }
    }

    return { clientX, clientY };
  }, []);

  const rememberPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY
    };
  }, []);

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    return {
      x: (viewportOffsetRef.current.x + pointX) / zoomRef.current,
      y: (viewportOffsetRef.current.y + pointY) / zoomRef.current
    };
  }, []);

  const commitDragPreview = useCallback((slotId: string, x: number, y: number) => {
    setDragPreview((current) => {
      if (!current || current.slotId !== slotId) {
        return { slotId, x, y };
      }
      if (Math.abs(current.x - x) < 0.01 && Math.abs(current.y - y) < 0.01) {
        return current;
      }
      return { ...current, x, y };
    });
  }, []);

  const flushDragPreview = useCallback(() => {
    dragPreviewFrameRef.current = null;
    const pending = pendingDragPreviewRef.current;
    pendingDragPreviewRef.current = null;
    if (!pending) return;
    commitDragPreview(pending.slotId, pending.x, pending.y);

    const state = dragRef.current;
    if (!state || state.slotId !== pending.slotId) return;

    const dragCenterX = pending.x + cardWidth / 2;
    const dragCenterY = pending.y + cardHeight / 2;
    let targetIndex = state.lastTargetIndex;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < items.length; index += 1) {
      const position = defaultSlotCanvasPosition(index, cardWidth);
      const centerX = position.x + cardWidth / 2;
      const centerY = position.y + cardHeight / 2;
      const distance = ((dragCenterX - centerX) ** 2) + ((dragCenterY - centerY) ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        targetIndex = index;
      }
    }

    if (targetIndex !== state.lastTargetIndex) {
      state.lastTargetIndex = targetIndex;
    }
  }, [cardHeight, cardWidth, commitDragPreview, items]);

  const scheduleDragPreview = useCallback((slotId: string, x: number, y: number) => {
    pendingDragPreviewRef.current = { slotId, x, y };
    if (dragPreviewFrameRef.current != null) return;
    dragPreviewFrameRef.current = window.requestAnimationFrame(flushDragPreview);
  }, [flushDragPreview]);

  const cancelScheduledDragPreview = useCallback(() => {
    pendingDragPreviewRef.current = null;
    if (dragPreviewFrameRef.current != null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
  }, []);

  const commitSlotNameEdit = useCallback((slotId: string) => {
    const nextName = editingSlotName.trim();
    setEditingSlotId(null);
    setEditingSlotName('');
    if (!nextName) return;
    onRename(slotId, nextName);
  }, [editingSlotName, onRename]);

  const cancelSlotNameEdit = useCallback(() => {
    setEditingSlotId(null);
    setEditingSlotName('');
  }, []);

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (dragRef.current) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      const anchor = resolveWheelAnchor(event.clientX, event.clientY);
      if (!anchor) return;

      const factor = Math.exp((-event.deltaY * 1.5) / 1000);
      applyZoomAtPoint(zoomRef.current * factor, anchor.clientX, anchor.clientY);
      return;
    }

    // Normalize wheel units so trackpads/mice behave consistently.
    const unitScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? viewport.clientHeight
        : 1;

    let rawX = event.deltaX * unitScale;
    let rawY = event.deltaY * unitScale;

    // WebKit fallback for environments where deltaX may be zeroed.
    const legacyEvent = event as WheelEvent & { wheelDeltaX?: number; wheelDeltaY?: number };
    if (Math.abs(rawX) < 0.01 && typeof legacyEvent.wheelDeltaX === 'number' && legacyEvent.wheelDeltaX !== 0) {
      rawX = -legacyEvent.wheelDeltaX;
    }
    if (Math.abs(rawY) < 0.01 && typeof legacyEvent.wheelDeltaY === 'number' && legacyEvent.wheelDeltaY !== 0) {
      rawY = -legacyEvent.wheelDeltaY;
    }
    const horizontalRaw = event.shiftKey && Math.abs(rawX) < 0.01 ? rawY : rawX;
    const verticalRaw = event.shiftKey && Math.abs(rawX) < 0.01 ? 0 : rawY;
    const normalizeWheelStep = (value: number) => {
      if (Math.abs(value) < 0.01) return 0;
      if (Math.abs(value) < 1) return Math.sign(value);
      return value;
    };
    const horizontal = normalizeWheelStep(horizontalRaw);
    const vertical = normalizeWheelStep(verticalRaw);

    if (Math.abs(horizontal) < 0.01 && Math.abs(vertical) < 0.01) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportOffset(
      viewportOffsetRef.current.x + horizontal,
      viewportOffsetRef.current.y + vertical,
      zoomRef.current
    );
  }, [applyZoomAtPoint, resolveWheelAnchor, setViewportOffset]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const viewportListener = (event: WheelEvent) => {
      handleCanvasWheel(event);
    };
    const windowFallbackListener = (event: WheelEvent) => {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;

      const target = event.target;
      const targetElement = target instanceof Element ? target : null;
      if (targetElement?.closest('[data-native-wheel]')) {
        return;
      }
      const targetInsideViewport = target instanceof Node && currentViewport.contains(target);
      if (targetInsideViewport) {
        handleCanvasWheel(event);
        return;
      }

      const rect = currentViewport.getBoundingClientRect();
      const eventInsideViewport = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;

      if (eventInsideViewport) {
        handleCanvasWheel(event);
        return;
      }

      if (event.clientX === 0 && event.clientY === 0) {
        const pointer = pointerRef.current;
        if (!pointer) return;
        const pointerInsideViewport = pointer.clientX >= rect.left
          && pointer.clientX <= rect.right
          && pointer.clientY >= rect.top
          && pointer.clientY <= rect.bottom;
        if (!pointerInsideViewport) return;
        handleCanvasWheel(event);
      }
    };

    viewport.addEventListener('wheel', viewportListener, { passive: false, capture: true });
    window.addEventListener('wheel', windowFallbackListener, { passive: false, capture: true });
    return () => {
      viewport.removeEventListener('wheel', viewportListener, { capture: true });
      window.removeEventListener('wheel', windowFallbackListener, { capture: true });
    };
  }, [handleCanvasWheel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePanRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePanRef.current = false;
      }
    };
    const handleBlur = () => {
      spacePanRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleZoomOut = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(zoomRef.current * 0.9, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const handleZoomIn = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(zoomRef.current * 1.1, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const handleZoomReset = useCallback(() => {
    const anchor = pickViewportCenterAnchor();
    if (!anchor) return;
    applyZoomAtPoint(1, anchor.clientX, anchor.clientY);
  }, [applyZoomAtPoint, pickViewportCenterAnchor]);

  const readPinch = useCallback((touches: ReactTouchEvent<HTMLDivElement>['touches']) => {
    if (touches.length < 2) return null;
    const t0 = touches[0];
    const t1 = touches[1];
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    const distance = Math.hypot(dx, dy);
    const centerX = (t0.clientX + t1.clientX) / 2;
    const centerY = (t0.clientY + t1.clientY) / 2;
    return { distance, centerX, centerY };
  }, []);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = {
      startDistance: pinch.distance,
      startZoom: zoomRef.current
    };
  }, [readPinch]);

  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch || !pinchRef.current) return;

    event.preventDefault();
    const scale = pinch.distance / pinchRef.current.startDistance;
    const acceleratedScale = scale >= 1
      ? 1 + ((scale - 1) * PINCH_ZOOM_ACCELERATION)
      : Math.max(0.1, 1 - ((1 - scale) * PINCH_ZOOM_ACCELERATION));
    const nextZoom = pinchRef.current.startZoom * acceleratedScale;
    applyZoomAtPoint(nextZoom, pinch.centerX, pinch.centerY);
  }, [applyZoomAtPoint, readPinch]);

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = readPinch(event.touches);
    if (!pinch) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = {
      startDistance: pinch.distance,
      startZoom: zoomRef.current
    };
  }, [readPinch]);

  const handleDragPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>, slotId: string) => {
    if (editingSlotId === slotId) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    const slotIndex = items.findIndex((item) => item.slot.id === slotId);
    if (slotIndex < 0) return;
    const basePosition = resolveSlotCanvasPosition(positions, slotId, slotIndex, cardWidth);
    const worldPoint = toWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) return;

    dragRef.current = {
      slotId,
      pointerId: event.pointerId,
      startIndex: slotIndex,
      lastTargetIndex: slotIndex,
      pointerOffsetX: worldPoint.x - basePosition.x,
      pointerOffsetY: worldPoint.y - basePosition.y
    };
    cancelScheduledDragPreview();
    commitDragPreview(slotId, basePosition.x, basePosition.y);
    panRef.current = null;
    cancelFocusAnimation();
    suppressNextSelectionCenterRef.current = true;
    // Keep selection ref in sync to avoid post-drag auto-centering jump.
    selectedSlotRef.current = slotId;

    onSelect(slotId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }, [cancelFocusAnimation, cancelScheduledDragPreview, cardWidth, commitDragPreview, editingSlotId, items, onSelect, positions, toWorldPoint]);

  const handleDragPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const worldPoint = toWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) return;
    const previewX = worldPoint.x - state.pointerOffsetX;
    const previewY = worldPoint.y - state.pointerOffsetY;

    scheduleDragPreview(state.slotId, previewX, previewY);

    event.stopPropagation();
    event.preventDefault();
  }, [scheduleDragPreview, toWorldPoint]);

  const handleDragPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    dragRef.current = null;
    cancelScheduledDragPreview();
    setDragPreview(null);
    if (state.lastTargetIndex !== state.startIndex) {
      onReorder(state.slotId, state.lastTargetIndex);
    }
    if (selectedSlot === state.slotId) {
      suppressNextSelectionCenterRef.current = false;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
    event.preventDefault();
  }, [cancelScheduledDragPreview, onReorder, selectedSlot]);

  useEffect(() => {
    return () => {
      if (focusAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(focusAnimationFrameRef.current);
      }
      if (dragPreviewFrameRef.current != null) {
        window.cancelAnimationFrame(dragPreviewFrameRef.current);
      }
      pendingDragPreviewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dragPreview) return;
    if (items.some((item) => item.slot.id === dragPreview.slotId)) return;
    dragRef.current = null;
    cancelScheduledDragPreview();
    setDragPreview(null);
  }, [cancelScheduledDragPreview, dragPreview, items]);

  useEffect(() => {
    if (!editingSlotId) return;
    if (items.some((item) => item.slot.id === editingSlotId)) return;
    setEditingSlotId(null);
    setEditingSlotName('');
  }, [editingSlotId, items]);

  const handleViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    const isInteractive = Boolean(target?.closest('button, input, textarea, select, [role="button"], [contenteditable="true"]'));
    const isOverSlotCard = Boolean(target?.closest('[data-slot-card]'));
    const allowPanByModifier = event.button === 1 || event.altKey || spacePanRef.current;
    if (isInteractive && !allowPanByModifier) return;
    if (isOverSlotCard && !allowPanByModifier) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: viewportOffsetRef.current.x,
      startTop: viewportOffsetRef.current.y
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (dragRef.current) return;

    setViewportOffset(
      state.startLeft - (event.clientX - state.startClientX),
      state.startTop - (event.clientY - state.startClientY),
      zoomRef.current
    );
    event.preventDefault();
  }, [setViewportOffset]);

  const handleViewportPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (delayMs: number) => {
      const timerId = window.setTimeout(() => {
        focusViewportOnSlotsRef.current('auto');
      }, delayMs);
      timers.push(timerId);
    };

    schedule(0);
    schedule(90);
    schedule(220);

    return () => {
      for (const timerId of timers) {
        window.clearTimeout(timerId);
      }
    };
  }, [focusTrigger]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const previous = selectedSlotRef.current;
    selectedSlotRef.current = selectedSlot;
    if (dragRef.current) return;
    if (previous === selectedSlot) return;
    if (suppressNextSelectionCenterRef.current) {
      suppressNextSelectionCenterRef.current = false;
      return;
    }

    const position = positions[selectedSlot];
    if (!position) return;

    const left = viewportOffsetRef.current.x;
    const top = viewportOffsetRef.current.y;
    const right = left + viewport.clientWidth;
    const bottom = top + viewport.clientHeight;
    const scaledX = position.x * zoomRef.current;
    const scaledY = position.y * zoomRef.current;
    const scaledWidth = cardWidth * zoomRef.current;
    const scaledHeight = cardHeight * zoomRef.current;
    const nodeLeft = scaledX;
    const nodeTop = scaledY;
    const nodeRight = scaledX + scaledWidth;
    const nodeBottom = scaledY + scaledHeight;

    const margin = 120;
    const visible = nodeLeft >= left + margin
      && nodeRight <= right - margin
      && nodeTop >= top + margin
      && nodeBottom <= bottom - margin;

    if (visible) return;

    setViewportOffset(
      nodeLeft - viewport.clientWidth / 2 + scaledWidth / 2,
      nodeTop - viewport.clientHeight / 2 + scaledHeight / 2,
      zoomRef.current
    );
  }, [cardHeight, cardWidth, positions, selectedSlot, setViewportOffset]);

  const dragCursorClass = dragPreview ? 'cursor-grabbing' : '';
  const viewportClassName = className
    ? `relative overflow-hidden overscroll-none ${dragCursorClass} ${className}`
    : `relative h-[78vh] overflow-hidden overscroll-none rounded-md border bg-muted/20 ${dragCursorClass}`;

  return (
    <div
      ref={viewportRef}
      className={viewportClassName}
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      onPointerDown={handleViewportPointerDown}
      onPointerUp={handleViewportPointerEnd}
      onPointerCancel={handleViewportPointerEnd}
      onPointerMove={rememberPointer}
      onPointerMoveCapture={handleViewportPointerMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div ref={boardTransformRef} className="absolute left-0 top-0" style={boardTransformStyle}>
        <div className="relative" style={boardContentStyle}>
          {items.map((item, index) => {
            const position = resolveSlotCanvasPosition(positions, item.slot.id, index, cardWidth);
            const dragState = dragRef.current;
            const isDragging = dragPreview?.slotId === item.slot.id;
            const isSelected = selectedSlot === item.slot.id;
            const isEditing = editingSlotId === item.slot.id;
            const slotLabel = item.slot.name;
            const draggedOffsetX = isDragging && dragPreview ? dragPreview.x - position.x : 0;
            const draggedOffsetY = isDragging && dragPreview ? dragPreview.y - position.y : 0;

            let displacedOffsetX = 0;
            let displacedOffsetY = 0;
            if (!isDragging && dragState && dragState.startIndex !== dragState.lastTargetIndex) {
              let previewIndex = index;

              if (dragState.startIndex < dragState.lastTargetIndex) {
                if (index > dragState.startIndex && index <= dragState.lastTargetIndex) {
                  previewIndex = index - 1;
                }
              } else if (dragState.startIndex > dragState.lastTargetIndex) {
                if (index >= dragState.lastTargetIndex && index < dragState.startIndex) {
                  previewIndex = index + 1;
                }
              }

              if (previewIndex !== index) {
                const previewPosition = defaultSlotCanvasPosition(previewIndex, cardWidth);
                displacedOffsetX = previewPosition.x - position.x;
                displacedOffsetY = previewPosition.y - position.y;
              }
            }

            const headerOffsetX = isDragging ? draggedOffsetX : displacedOffsetX;
            const headerOffsetY = isDragging ? draggedOffsetY : displacedOffsetY;
            const cardStyle: CSSProperties = {
              left: position.x,
              top: position.y,
              width: cardWidth
            };
            const dragHandleStyle: CSSProperties = isDragging
              ? {
                position: 'relative',
                zIndex: 40,
                transform: `translate3d(${headerOffsetX}px, ${headerOffsetY}px, 0)`,
                willChange: 'transform'
              }
              : {
                position: 'relative',
                zIndex: displacedOffsetX !== 0 || displacedOffsetY !== 0 ? 30 : 1,
                transform: `translate3d(${headerOffsetX}px, ${headerOffsetY}px, 0)`,
                transition: 'transform 120ms ease'
              };

            return (
              <div
                key={item.slot.id}
                data-slot-card
                className={`absolute ${isDragging ? 'z-30' : ''}`}
                style={cardStyle}
              >
                {isEditing ? (
                  <div
                    className="mb-2 rounded-md border border-primary/70 bg-primary/10 p-1.5"
                    style={dragHandleStyle}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Input
                      value={editingSlotName}
                      onChange={(event) => setEditingSlotName(event.target.value)}
                      onBlur={() => commitSlotNameEdit(item.slot.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitSlotNameEdit(item.slot.id);
                          return;
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelSlotNameEdit();
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      autoFocus
                      className="h-7 text-xs"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`mb-2 flex w-full items-center justify-between rounded-md border px-2 py-1 text-[11px] ${
                      isDragging
                        ? 'cursor-grabbing border-primary/70 bg-primary/15 text-primary shadow-xl'
                        : isSelected
                          ? 'cursor-grab border-primary/60 bg-primary/10 text-primary shadow-md'
                          : 'cursor-grab border-border bg-card/90 shadow-sm backdrop-blur hover:bg-card'
                    }`}
                    style={dragHandleStyle}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditingSlotId(item.slot.id);
                      setEditingSlotName(slotLabel);
                    }}
                    onPointerDown={(event) => handleDragPointerDown(event, item.slot.id)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerEnd}
                    onPointerCancel={handleDragPointerEnd}
                  >
                    <span className={`font-medium ${isDragging || isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {slotLabel}
                    </span>
                  </button>
                )}

                <div className={isDragging ? 'rounded-md ring-2 ring-primary/35 shadow-2xl' : ''}>
                  <SlotCard
                    slot={item.slot}
                    titleValue={item.titleValue}
                    subtitleValue={item.subtitleValue}
                    renderedPreviewUrl={item.renderedPreviewUrl}
                    sourceImageUrl={item.sourceImageUrl}
                    template={item.template}
                    templateImageUrls={templateImageUrls}
                    device={device}
                    onSelect={onSelect}
                    editable={isSelected}
                    selectedElementId={selectedTemplateElementId}
                    onSelectElement={onSelectTemplateElement}
                    onMoveElement={onMoveTemplateElement}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur">
          <Button type="button" size="sm" variant="outline" onClick={handleZoomOut}>-</Button>
          <Button type="button" size="sm" variant="outline" onClick={handleZoomIn}>+</Button>
          <Button type="button" size="sm" variant="outline" onClick={handleZoomReset}>
            <span ref={zoomLabelRef}>100%</span>
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => focusViewportOnSlots('smooth')}>
            Fit
          </Button>
        </div>
      </div>
    </div>
  );
});
