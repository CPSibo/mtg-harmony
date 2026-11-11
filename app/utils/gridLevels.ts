/** Board pixels per cell when snapping is off. */
export const DEFAULT_CELL = 40;
/** Each grid level's cells are this many of the level below. */
export const GRID_FACTOR = 5;
/** Screen pixels: minor lines closer than this give way to the next level. */
export const MIN_GAP = 8;

export interface GridLevels {
  /** Minor cell size, in board pixels. */
  minor: number;
  /** Major cell size, in board pixels: `minor * GRID_FACTOR`. */
  major: number;
  /** Opacity of the minor lines, 0–1. Major lines are always fully drawn. */
  minorAlpha: number;
}

/**
 * The two grid levels to draw at a zoom, like a 3D editor's grid. The finest
 * level is the snap grid, so the lines show where cards will land. Zooming out
 * fades the minor lines away as they close up, until they hit `MIN_GAP` and the
 * major lines take over as the new minor ones, at full strength, so nothing
 * jumps.
 */
export function gridLevels(snap: number, scale: number): GridLevels {
  const base = snap > 0 ? snap : DEFAULT_CELL;
  const k = Math.max(
    0,
    Math.ceil(Math.log(MIN_GAP / (base * scale)) / Math.log(GRID_FACTOR)),
  );
  const minor = base * GRID_FACTOR ** k;
  // 0 at MIN_GAP, 1 at one level up, on a log scale so each level fades alike.
  const t = Math.log((minor * scale) / MIN_GAP) / Math.log(GRID_FACTOR);
  return {
    minor,
    major: minor * GRID_FACTOR,
    minorAlpha: Math.min(1, Math.max(0, t)),
  };
}
