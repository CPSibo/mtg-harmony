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
    case 'tilt': {
      // A toss: a quick wind-up, a fast throw lifted off the table with a
      // twist, a slap down that skids a touch past the spot, then settles.
      // Each leg has its own easing; the whole runs linear.
      const hw = from.width / 2;
      const hh = from.height / 2;
      const pose = (deg: number, lift: number) =>
        `translate(${hw}px, ${hh}px) rotate(${deg * lean}deg) ` +
        `scale(${lift}) translate(${-hw}px, ${-hh}px)`;
      return [
        { transform: at(0, pose(0, 1)), easing: 'ease-out' },
        {
          transform: at(-0.04, pose(-10, 1.06), 12),
          offset: 0.14,
          easing: 'cubic-bezier(0.5, 0, 0.6, 1)',
        },
        {
          transform: at(0.8, pose(16, 1.14), 18),
          offset: 0.62,
          easing: 'cubic-bezier(0.3, 0.6, 0.6, 1)',
        },
        {
          transform: at(1.03, pose(-4, 0.96)),
          offset: 0.82,
          easing: 'ease-out',
        },
        { transform: at(1, pose(0, 1)) },
      ];
    }
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

/** Overall easing, and the share of the flight after which it counts as landed. */
export function flightTiming(flight: Exclude<CastFlight, 'off'>) {
  // Tilt's keyframes carry their own easing and end in motion (the skid),
  // so it plays out. Arc's ease-out tail is all but still, so it's cut.
  return flight === 'tilt'
    ? { easing: 'linear', landAt: 1 }
    : { easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)', landAt: 0.78 };
}
