import type { Position } from '@vueuse/core';

/**
 * How drags and pans follow the pointer between its updates (#104). A mouse
 * reports ~125 times a second, so on a faster screen some frames get no new
 * position.
 * - `off`: jump to each reported position.
 * - `predict`: jump to where the browser predicts the pointer is now
 *   (`getPredictedEvents`). No lag; can overshoot a little at a quick stop.
 * - `ease`: glide towards each reported position every frame. Smooths gaps;
 *   trails the pointer by a frame or two.
 */
export type PointerSmoothing = 'off' | 'predict' | 'ease';

export const POINTER_SMOOTHING_MODES: readonly PointerSmoothing[] = [
  'off',
  'predict',
  'ease',
];

/** How quickly `ease` catches up: the time constant, in ms. */
const EASE_MS = 30;

/** The pointer's position for a move, predicted in `predict` mode. */
export function pointerPosition(
  e: MouseEvent,
  mode: PointerSmoothing,
): Position {
  if (mode === 'predict' && 'getPredictedEvents' in e) {
    const predicted = (e as PointerEvent).getPredictedEvents().at(-1);
    if (predicted) return { x: predicted.clientX, y: predicted.clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

/**
 * Moves something to target positions through `apply`: straight away, or in
 * `ease` mode a step per frame. Plain variables: only `apply` touches state.
 */
export function createFollower(
  apply: (position: Position) => void,
  mode: () => PointerSmoothing,
) {
  let target: Position | null = null;
  let current: Position | null = null;
  let frame = 0;
  let last = 0;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function step(time: number) {
    if (!target || !current) return stop();
    const k = 1 - Math.exp(-Math.max(0, time - last) / EASE_MS);
    last = time;
    current = {
      x: current.x + (target.x - current.x) * k,
      y: current.y + (target.y - current.y) * k,
    };
    if (Math.hypot(target.x - current.x, target.y - current.y) < 0.1) {
      current = target;
      apply(current);
      frame = 0;
      return;
    }
    apply(current);
    frame = requestAnimationFrame(step);
  }

  return {
    /** Starts from `position`, with no easing. */
    jump(position: Position) {
      stop();
      target = current = position;
    },
    /** Heads for `position`. */
    to(position: Position) {
      target = position;
      if (mode() !== 'ease' || !current) {
        current = position;
        apply(position);
        return;
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    },
    /** Lands on the last target now, and returns it. */
    finish(): Position | null {
      stop();
      if (target) {
        current = target;
        apply(target);
      }
      return target;
    },
  };
}
