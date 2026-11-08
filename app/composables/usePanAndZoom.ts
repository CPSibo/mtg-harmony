import { useWindowSize } from '@vueuse/core';
import { computed, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { ElementSize, Position } from '@vueuse/core';
import { createFollower } from './pointerSmoothing';

export interface PanAndZoomSettings {
  size: ElementSize;
  onEnd?: (position: Position) => void;
  disabled?: MaybeRefOrGetter<boolean>;
  /** Pan easing in ms; 0 is off (#104). */
  smoothing?: MaybeRefOrGetter<number>;
}

export function usePanAndZoom(settings: PanAndZoomSettings) {
  const isEnabled = computed(() => {
    return !(toValue(settings.disabled) ?? false);
  });

  // Fixed for the board's life, so not reactive.
  const size: ElementSize = settings?.size ?? { width: 5000, height: 5000 };

  const { width: windowWidth, height: windowHeight } = useWindowSize();

  const halfWindowWidth = computed(() => windowWidth.value / 2.0);
  const halfWindowHeight = computed(() => windowHeight.value / 2.0);

  const scale = ref(1.5);
  const position = ref<Position>({
    x: (-size.width / 2) * scale.value + halfWindowWidth.value,
    y: (-size.height / 2) * scale.value + halfWindowHeight.value,
  });
  const center = computed(() => {
    return {
      x: -position.value.x / scale.value + halfWindowWidth.value / 2,
      y: -position.value.y / scale.value + halfWindowHeight.value / 2,
    };
  });

  const smoothing = () => toValue(settings.smoothing) ?? 0;
  // Pans go through this, so they can ease (#104). Zoom is immediate.
  const panFollower = createFollower((p) => {
    position.value = clampPosition(p.x, p.y);
  }, smoothing);

  const scrollSpeed = 0.1;
  const pinchSpeed = 0.01;

  // Shown by the board (its cursor), so reactive.
  const isDragging = ref(false);
  // Only the handlers read the rest of the gesture state, so it isn't.
  let dragStart: Position = { x: 0, y: 0 };
  let positionAtDragStart: Position = { x: 0, y: 0 };

  // Touch state for pinch and single-finger pan
  // Touch points currently on the screen, by Touch.identifier. Not reactive:
  // only the touch handlers read it.
  const activeTouches = new Map<number, Position>();
  let pinchStartDistance: number | null = null;
  let scaleAtPinchStart = 1.0;

  const style = computed(() => {
    const width = `width:${size.width}px`;
    const height = `height:${size.height}px`;
    const transform = `transform:translate(${position.value.x}px, ${position.value.y}px) scale(${scale.value})`;

    return [width, height, transform].reduce(
      (total, current) => `${total}${current};`,
      '',
    );
  });

  // ─── Wheel (scroll-to-zoom + pinch-to-zoom) ──────────────────────────────

  function onWheel(e: WheelEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();
    panFollower.finish();

    let delta = e.deltaY;
    let factor: number;

    const isPinch = e.ctrlKey && e.deltaMode === 0 && !Number.isInteger(delta);

    if (isPinch) {
      factor = 1 - delta * pinchSpeed;
    } else {
      if (e.deltaMode === 0) delta /= 100;
      if (e.deltaMode === 1) delta /= 3;
      factor = 1 - delta * scrollSpeed;
    }

    // Cursor position relative to the canvas origin (top-left corner)
    const originX = position.value.x;
    const originY = position.value.y;
    const cursorX = e.clientX - originX;
    const cursorY = e.clientY - originY;

    const requestedScale = scale.value * factor;

    const previousScale = scale.value;
    scale.value = clampScale(requestedScale);

    const appliedFactor = scale.value / previousScale;

    if (scale.value !== previousScale) {
      // Shift position so the point under the cursor stays fixed
      const requestedX = position.value.x - cursorX * (appliedFactor - 1);
      const requestedY = position.value.y - cursorY * (appliedFactor - 1);

      position.value = clampPosition(requestedX, requestedY);
    }

    if (settings.onEnd) settings.onEnd(position.value);
  }

  // ─── Mouse pan ───────────────────────────────────────────────────────────

  function onMouseDown(e: MouseEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();
    isDragging.value = true;
    dragStart = { x: e.clientX, y: e.clientY };
    positionAtDragStart = { ...position.value };
    panFollower.jump(positionAtDragStart);
  }

  function onMouseMove(e: MouseEvent) {
    if (!isEnabled.value) return;

    if (!isDragging.value) return;

    const pointer = { x: e.clientX, y: e.clientY };
    panFollower.to({
      x: positionAtDragStart.x + (pointer.x - dragStart.x),
      y: positionAtDragStart.y + (pointer.y - dragStart.y),
    });
  }

  function clampPosition(requestedX: number, requestedY: number) {
    const minAllowableX = -size.width * scale.value + windowWidth.value;
    const maxAllowableX = 0;

    const minAllowableY = -size.height * scale.value + windowHeight.value;
    const maxAllowableY = 0;

    const finalX = Math.min(Math.max(requestedX, minAllowableX), maxAllowableX);
    const finalY = Math.min(Math.max(requestedY, minAllowableY), maxAllowableY);

    return {
      x: finalX,
      y: finalY,
    };
  }

  function clampScale(requestedScale: number) {
    const minAllowableScale = Math.max(
      windowWidth.value / size.width,
      windowHeight.value / size.height,
    );
    const maxAllowableScale = 3;

    return Math.min(
      Math.max(requestedScale, minAllowableScale),
      maxAllowableScale,
    );
  }

  function endPan() {
    panFollower.finish();
    isDragging.value = false;
  }

  function onMouseUp(_e: MouseEvent) {
    if (!isEnabled.value) return;

    endPan();
  }

  function onMouseLeave(_e: MouseEvent) {
    if (!isEnabled.value) return;

    endPan();
  }

  // ─── Touch pan + pinch-to-zoom ───────────────────────────────────────────

  function getTouchDistance(a: Position, b: Position): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function getTouchMidpoint(a: Position, b: Position): Position {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onTouchStart(e: TouchEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();

    for (const touch of e.changedTouches) {
      activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      });
    }

    const touchList = [...activeTouches.values()];

    if (touchList.length === 1) {
      // Single finger: begin pan
      isDragging.value = true;
      dragStart = { ...touchList[0]! };
      positionAtDragStart = { ...position.value };
      panFollower.jump(positionAtDragStart);
    } else if (touchList.length === 2) {
      // Two fingers: begin pinch, cancel pan
      panFollower.finish();
      isDragging.value = false;
      pinchStartDistance = getTouchDistance(touchList[0]!, touchList[1]!);
      scaleAtPinchStart = scale.value;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();

    for (const touch of e.changedTouches) {
      activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      });
    }

    const touchList = [...activeTouches.values()];

    if (touchList.length === 1 && isDragging.value) {
      // Pan
      panFollower.to({
        x: positionAtDragStart.x + (touchList[0]!.x - dragStart.x),
        y: positionAtDragStart.y + (touchList[0]!.y - dragStart.y),
      });
    } else if (touchList.length === 2 && pinchStartDistance !== null) {
      const currentDistance = getTouchDistance(touchList[0]!, touchList[1]!);
      const factor =
        (scaleAtPinchStart * (currentDistance / pinchStartDistance)) /
        scale.value;

      const midpoint = getTouchMidpoint(touchList[0]!, touchList[1]!);

      const midX = midpoint.x - position.value.x;
      const midY = midpoint.y - position.value.y;

      const requestedScale = scale.value * factor;

      const previousScale = scale.value;
      scale.value = clampScale(requestedScale);

      const appliedFactor = scale.value / previousScale;

      if (scale.value !== previousScale) {
        // Shift canvas so the pinch midpoint stays fixed on screen.
        const requestedX = position.value.x - midX * (appliedFactor - 1);
        const requestedY = position.value.y - midY * (appliedFactor - 1);

        position.value = clampPosition(requestedX, requestedY);
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();

    for (const touch of e.changedTouches) {
      activeTouches.delete(touch.identifier);
    }

    const touchList = [...activeTouches.values()];

    if (touchList.length < 2) {
      pinchStartDistance = null;
    }

    if (touchList.length === 0) {
      endPan();
    } else if (touchList.length === 1) {
      // Finger lifted during pinch → resume pan with remaining finger
      isDragging.value = true;
      dragStart = { ...touchList[0]! };
      positionAtDragStart = { ...position.value };
      panFollower.jump(positionAtDragStart);
    }
  }

  watch(isDragging, (value) => {
    if (value) return;

    if (settings.onEnd) settings.onEnd(position.value);
  });

  return {
    isEnabled,
    size,
    position,
    center,
    scale,
    style,
    isDragging,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
