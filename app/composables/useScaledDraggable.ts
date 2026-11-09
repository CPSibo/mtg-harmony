import type { Position } from '@vueuse/core';
import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { createFollower } from './pointerSmoothing';

export interface UseBoardDraggableOptions {
  initialValue?: Position;
  /** The board's zoom; pointer movement is divided by it. */
  scale?: MaybeRefOrGetter<number>;
  /** Grid size in board pixels; 0 doesn't snap. */
  snapScale?: MaybeRefOrGetter<number>;
  /** Keeps the element inside this one. */
  containerElement?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  disabled?: MaybeRefOrGetter<boolean>;
  /** Easing in ms; 0 is off (#104). */
  smoothing?: MaybeRefOrGetter<number>;
  onStart?: (event: PointerEvent) => void;
  /** Each pointer move of a drag, before smoothing. */
  onMove?: (event: PointerEvent) => void;
  onEnd?: (position: Position, event: PointerEvent) => void;
}

/**
 * Drags an element across the board with the primary pointer button, a
 * finger or a pen. The element listens for its own presses; the window is
 * only listened to while a drag is under way, so a board of many stacks
 * doesn't run a handler per stack on every pointer move (#103).
 */
export function useBoardDraggable(
  el: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: UseBoardDraggableOptions = {},
) {
  const scale = () => toValue(options.scale) || 1;
  const snap = () => toValue(options.snapScale) ?? 0;
  const smoothing = () => toValue(options.smoothing) ?? 0;

  const x = ref(options.initialValue?.x ?? 0);
  const y = ref(options.initialValue?.y ?? 0);
  const isDragging = ref(false);

  // The gesture's state; only the handlers read it.
  let pointerId: number | null = null;
  let startPointer: Position = { x: 0, y: 0 };
  let start: Position = { x: 0, y: 0 };
  // How far the element can go, in board pixels. Measured when a drag
  // starts, not on every move: reading layout each move forces a layout.
  let max: Position = { x: Infinity, y: Infinity };

  const follower = createFollower((p) => {
    x.value = p.x;
    y.value = p.y;
  }, smoothing);

  const clamp = (v: number, hi: number) => Math.min(Math.max(v, 0), hi);
  const snapTo = (v: number, grid: number) =>
    grid > 0 ? Math.round(v / grid) * grid : v;

  function measureBounds() {
    const container = toValue(options.containerElement);
    const self = toValue(el);
    if (!container || !self) {
      max = { x: Infinity, y: Infinity };
      return;
    }
    const outer = container.getBoundingClientRect();
    const inner = self.getBoundingClientRect();
    max = {
      x: Math.max(0, (outer.width - inner.width) / scale()),
      y: Math.max(0, (outer.height - inner.height) / scale()),
    };
  }

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || pointerId !== null || toValue(options.disabled))
      return;
    // Keeps the board from panning and the page from scrolling, without
    // stopping the event: buttons on the stack still get their clicks.
    e.preventDefault();
    pointerId = e.pointerId;
    startPointer = { x: e.clientX, y: e.clientY };
    start = { x: x.value, y: y.value };
    measureBounds();
    follower.jump(start);
    isDragging.value = true;
    window.addEventListener('pointermove', onMove, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onUp, { capture: true });
    options.onStart?.(e);
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    const p = { x: e.clientX, y: e.clientY };
    const s = scale();
    follower.to({
      x: clamp(snapTo(start.x + (p.x - startPointer.x) / s, snap()), max.x),
      y: clamp(snapTo(start.y + (p.y - startPointer.y) / s, snap()), max.y),
    });
    options.onMove?.(e);
  }

  function stopListening() {
    window.removeEventListener('pointermove', onMove, { capture: true });
    window.removeEventListener('pointerup', onUp, { capture: true });
    window.removeEventListener('pointercancel', onUp, { capture: true });
  }

  function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    stopListening();
    pointerId = null;
    const end = follower.finish() ?? start;
    isDragging.value = false;
    options.onEnd?.({ ...end }, e);
  }

  // The element's own listener, moved along if the element changes.
  watch(
    () => toValue(el),
    (next, prev) => {
      prev?.removeEventListener('pointerdown', onDown, { capture: true });
      next?.addEventListener('pointerdown', onDown, { capture: true });
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    toValue(el)?.removeEventListener('pointerdown', onDown, { capture: true });
    stopListening();
    follower.finish();
  });

  // A transform, not left/top, so a move skips layout.
  const style = computed(
    () => `transform: translate(${x.value}px, ${y.value}px);`,
  );

  return { x, y, isDragging, style };
}
