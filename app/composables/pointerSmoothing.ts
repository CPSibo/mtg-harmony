import type { Position } from '@vueuse/core';

/**
 * Easing for drags and pans (#104). A mouse reports ~125 times a second, so
 * on a faster screen some frames get no new position. With easing, the
 * dragged thing glides towards each reported position every frame instead
 * of jumping to it. The value is the time constant in ms: 0 is off, and
 * larger is smoother but trails the pointer more. (Predicted pointer events
 * were tried and jittered badly around the cursor.)
 */
export const MAX_POINTER_EASE_MS = 60;

export function isPointerEase(value: unknown): value is number {
  return (
    typeof value === 'number' && value >= 0 && value <= MAX_POINTER_EASE_MS
  );
}

/**
 * Moves something to target positions through `apply`: straight away, or
 * with easing a step per frame. Plain variables: only `apply` touches state.
 */
export function createFollower(
  apply: (position: Position) => void,
  easeMs: () => number,
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
    const ms = easeMs();
    const k = ms > 0 ? 1 - Math.exp(-Math.max(0, time - last) / ms) : 1;
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
      if (easeMs() <= 0 || !current) {
        stop();
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
