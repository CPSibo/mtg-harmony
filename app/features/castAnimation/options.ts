// No imports: the settings store reads these.

/** How a cast card travels from where it was shown to the board (#124). */
export const CAST_FLIGHTS = ['off', 'tilt', 'arc'] as const;
export type CastFlight = (typeof CAST_FLIGHTS)[number];

/** What happens where a cast card lands (#124). */
export const CAST_LANDINGS = [
  'none',
  'sparkle',
  'ring',
  'sparkleRing',
] as const;
export type CastLanding = (typeof CAST_LANDINGS)[number];

export const CAST_FLIGHT_DEFAULT: CastFlight = 'tilt';
export const CAST_LANDING_DEFAULT: CastLanding = 'sparkleRing';

/** Flight time, in ms. */
export const CAST_DURATION_DEFAULT = 350;
export const MIN_CAST_DURATION_MS = 200;
export const MAX_CAST_DURATION_MS = 1200;

export function isCastFlight(value: unknown): value is CastFlight {
  return CAST_FLIGHTS.includes(value as CastFlight);
}

export function isCastLanding(value: unknown): value is CastLanding {
  return CAST_LANDINGS.includes(value as CastLanding);
}

export function isCastDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    value >= MIN_CAST_DURATION_MS &&
    value <= MAX_CAST_DURATION_MS
  );
}
