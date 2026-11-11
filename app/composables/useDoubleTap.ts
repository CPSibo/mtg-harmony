import { useEventListener } from '@vueuse/core';
import type { MaybeRefOrGetter } from 'vue';

const MAX_DELAY_MS = 300;
const MAX_DISTANCE_PX = 25;

/**
 * Calls `handler` on a double click or double tap on `target`. iOS Safari
 * fires no `dblclick` for a double tap, so touch is detected from pointer
 * events. Android does fire `dblclick` for touch, so `dblclick` is ignored
 * after touch input to avoid calling `handler` twice.
 */
export function useDoubleTap(
  target: MaybeRefOrGetter<EventTarget | null | undefined>,
  handler: (event: MouseEvent) => void,
) {
  let downX = 0;
  let downY = 0;
  // The last tap that could start a double tap.
  let last: { time: number; x: number; y: number } | undefined;
  let lastPointerType = '';

  useEventListener(target, 'pointerdown', (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    lastPointerType = e.pointerType;
  });

  useEventListener(target, 'dblclick', (e: MouseEvent) => {
    if (lastPointerType !== 'touch') handler(e);
  });

  useEventListener(target, 'pointerup', (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    // A drag isn't a tap.
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > MAX_DISTANCE_PX) {
      last = undefined;
      return;
    }

    const now = Date.now();
    if (
      last &&
      now - last.time <= MAX_DELAY_MS &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) <= MAX_DISTANCE_PX
    ) {
      last = undefined;
      handler(e);
      return;
    }
    last = { time: now, x: e.clientX, y: e.clientY };
  });
}
