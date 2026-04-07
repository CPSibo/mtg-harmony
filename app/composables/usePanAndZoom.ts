import type { ElementSize, Position } from '@vueuse/core';

export interface PanAndZoomSettings {
  size: ElementSize;
  onEnd?: (position: Position) => void;
  disabled?: MaybeRefOrGetter<boolean>;
}

export function usePanAndZoom(settings: PanAndZoomSettings) {
  const isEnabled = computed(() => {
    return !(toValue(settings.disabled) ?? false);
  });

  const size = ref<ElementSize>(
    settings?.size ?? { width: 5000, height: 5000 },
  );

  const halfWidth = computed(() => size.value.width / 2.0);
  const halfHeight = computed(() => size.value.height / 2.0);

  const { width: windowWidth, height: windowHeight } = useWindowSize();

  const halfWindowWidth = computed(() => windowWidth.value / 2.0);
  const halfWindowHeight = computed(() => windowHeight.value / 2.0);

  const scale = ref(1.5);
  const position = ref<Position>({
    x: -halfWidth.value * scale.value + halfWindowWidth.value,
    y: -halfHeight.value * scale.value + halfWindowHeight.value,
  });
  const center = computed(() => {
    return {
      x: -position.value.x / scale.value + halfWindowWidth.value / 2,
      y: -position.value.y / scale.value + halfWindowHeight.value / 2,
    };
  });

  const scrollSpeed = ref(0.1);
  const pinchSpeed = ref(0.01);

  // Internal pan state — not exposed
  const isDragging = ref(false);
  const dragStart = ref<Position>({ x: 0, y: 0 });
  const positionAtDragStart = ref<Position>({ x: 0, y: 0 });

  // Touch state for pinch and single-finger pan
  const activeTouches = ref<Record<number, Position>>({});
  const pinchStartDistance = ref<number | null>(null);
  const scaleAtPinchStart = ref(1.0);

  const style = computed(() => {
    const width = `width:${size.value.width}px`;
    const height = `height:${size.value.height}px`;
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

    let delta = e.deltaY;
    let factor: number;

    const isPinch = e.ctrlKey && e.deltaMode === 0 && !Number.isInteger(delta);

    if (isPinch) {
      factor = 1 - delta * pinchSpeed.value;
    } else {
      if (e.deltaMode === 0) delta /= 100;
      if (e.deltaMode === 1) delta /= 3;
      factor = 1 - delta * scrollSpeed.value;
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
    dragStart.value = { x: e.clientX, y: e.clientY };
    positionAtDragStart.value = { ...position.value };
  }

  function onMouseMove(e: MouseEvent) {
    if (!isEnabled.value) return;

    if (!isDragging.value) return;

    const requestedX =
      positionAtDragStart.value.x + (e.clientX - dragStart.value.x);
    const requestedY =
      positionAtDragStart.value.y + (e.clientY - dragStart.value.y);

    position.value = clampPosition(requestedX, requestedY);
  }

  function clampPosition(requestedX: number, requestedY: number) {
    const minAllowableX = -size.value.width * scale.value + windowWidth.value;
    const maxAllowableX = 0;

    const minAllowableY = -size.value.height * scale.value + windowHeight.value;
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
      windowWidth.value / size.value.width,
      windowHeight.value / size.value.height,
    );
    const maxAllowableScale = 3;

    return Math.min(
      Math.max(requestedScale, minAllowableScale),
      maxAllowableScale,
    );
  }

  function onMouseUp(_e: MouseEvent) {
    if (!isEnabled.value) return;

    isDragging.value = false;
  }

  function onMouseLeave(_e: MouseEvent) {
    if (!isEnabled.value) return;

    isDragging.value = false;
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
      activeTouches.value[touch.identifier] = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    const touchList = Object.values(activeTouches.value);

    if (touchList.length === 1) {
      // Single finger: begin pan
      isDragging.value = true;
      dragStart.value = { ...touchList[0]! };
      positionAtDragStart.value = { ...position.value };
    } else if (touchList.length === 2) {
      // Two fingers: begin pinch, cancel pan
      isDragging.value = false;
      pinchStartDistance.value = getTouchDistance(touchList[0]!, touchList[1]!);
      scaleAtPinchStart.value = scale.value;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isEnabled.value) return;

    e.preventDefault();

    for (const touch of e.changedTouches) {
      activeTouches.value[touch.identifier] = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    const touchList = Object.values(activeTouches.value);

    if (touchList.length === 1 && isDragging.value) {
      // Pan
      position.value = {
        x: positionAtDragStart.value.x + (touchList[0]!.x - dragStart.value.x),
        y: positionAtDragStart.value.y + (touchList[0]!.y - dragStart.value.y),
      };
    } else if (touchList.length === 2 && pinchStartDistance.value !== null) {
      const currentDistance = getTouchDistance(touchList[0]!, touchList[1]!);
      const factor =
        (scaleAtPinchStart.value *
          (currentDistance / pinchStartDistance.value)) /
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
      delete activeTouches.value[touch.identifier];
    }

    const touchList = Object.values(activeTouches.value);

    if (touchList.length < 2) {
      pinchStartDistance.value = null;
    }

    if (touchList.length === 0) {
      isDragging.value = false;
    } else if (touchList.length === 1) {
      // Finger lifted during pinch → resume pan with remaining finger
      isDragging.value = true;
      dragStart.value = { ...touchList[0]! };
      positionAtDragStart.value = { ...position.value };
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
