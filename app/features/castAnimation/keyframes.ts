import type { CastFlight } from './options';

/** A screen rectangle: the parts of DOMRect the animation needs. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Keyframes that move an element laid out at `from` (fixed, top-left origin)
 * onto `to`, in the given style. Only `transform` changes, so it stays on the
 * compositor.
 */
export function flightKeyframes(
  flight: Exclude<CastFlight, 'off'>,
  from: ScreenRect,
  to: ScreenRect,
): Keyframe[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  // Lean into the direction of travel.
  const lean = dx >= 0 ? 1 : -1;
  const arcLift = Math.min(240, Math.hypot(dx, dy) * 0.35);
  const at = (t: number, extra: string, lift = 0) =>
    `translate(${dx * t}px, ${dy * t - lift}px) ` +
    `scale(${1 + (sx - 1) * t}, ${1 + (sy - 1) * t}) ${extra}`;

  switch (flight) {
    case 'tilt':
      return [
        { transform: at(0, 'rotate(0deg)') },
        { transform: at(0.15, `rotate(${-8 * lean}deg)`), offset: 0.15 },
        { transform: at(0.7, `rotate(${12 * lean}deg)`), offset: 0.7 },
        { transform: at(1, 'rotate(0deg)') },
      ];
    case 'arc':
      return [
        { transform: at(0, 'rotate(0deg)') },
        {
          transform: at(0.5, `rotate(${-14 * lean}deg)`, arcLift),
          offset: 0.5,
        },
        { transform: at(1, 'rotate(0deg)') },
      ];
  }
}

/** Evenly spread directions for `count` sparkles, in radians. */
export function sparkleAngles(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2);
}
