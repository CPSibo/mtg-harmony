import type { BoardColor } from './colors';
import { fmt } from './geometry';
import { mod } from './shuffle';

/** Spotlight spacing, in board px. */
export const SPOTLIGHT_SPACING = 900;
/** Spotlight radius, relative to the spacing. */
export const SPOTLIGHT_RADIUS = 1.35;
/** Rows are this much of the spacing apart, offset by half a step. */
const ROW = 0.87;

/** One theme's spotlight colours and strength at their centres. */
export interface SpotlightPalette {
  colors: Readonly<Record<BoardColor, string>>;
  strength: number;
}

/** Black is a purple: pure black vanishes on the dark board. */
export const DARK_SPOTLIGHTS: SpotlightPalette = Object.freeze({
  colors: Object.freeze({
    W: '#f3e9c6',
    U: '#3b82c4',
    B: '#7a56a0',
    R: '#d0453a',
    G: '#3f9a5a',
    C: '#8f8b84',
  }),
  strength: 0.08,
});

/** The light board: a warmer white, which would vanish otherwise, a little stronger. */
export const LIGHT_SPOTLIGHTS: SpotlightPalette = Object.freeze({
  colors: Object.freeze({ ...DARK_SPOTLIGHTS.colors, W: '#e0bf5c' }),
  strength: 0.1,
});

export interface SpotlightTile {
  svg: string;
  width: number;
  height: number;
}

/**
 * The spotlights for a colour selection as one SVG that repeats to the
 * board's edges (#246), or null with no colours. Spotlights sit in staggered
 * rows, colours running diagonally; the block that repeats is m × m
 * spotlights, m the smallest multiple of the colour count that's at least 3,
 * so the runs line up across blocks. Each is drawn again one block over
 * wherever it crosses an edge, so the tiles meet without seams; its radius is
 * capped at half the block so those copies are enough.
 *
 * One image, not a CSS gradient layer per spotlight: the browser can keep it
 * rasterised while panning, where 9 to 36 gradient layers repaint every frame.
 */
export function spotlightTile(
  colors: readonly BoardColor[],
  palette: SpotlightPalette,
): SpotlightTile | null {
  const n = colors.length;
  if (!n) return null;
  let m = n;
  while (m < 3) m += n;
  const d = SPOTLIGHT_SPACING;
  const width = m * d;
  const height = width * ROW;
  const r = Math.min(SPOTLIGHT_RADIUS * d, width / 2);
  const p = palette.strength;

  let defs = '';
  for (const c of colors)
    defs +=
      `<radialGradient id='s${c}'>` +
      `<stop offset='0' stop-color='${palette.colors[c]}' stop-opacity='${p}'/>` +
      `<stop offset='.5' stop-color='${palette.colors[c]}' stop-opacity='${+(p * 0.4).toFixed(4)}'/>` +
      `<stop offset='1' stop-color='${palette.colors[c]}' stop-opacity='0'/></radialGradient>`;

  let body = '';
  for (let i = 0; i < m; i++)
    for (let j = 0; j < m; j++) {
      const fill = `url(#s${colors[mod(i + j, n)]})`;
      const x = (i + 0.5 * (j % 2)) * d;
      const y = j * d * ROW;
      for (const ox of [-width, 0, width])
        for (const oy of [-height, 0, height]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx + r <= 0 || cx - r >= width || cy + r <= 0 || cy - r >= height)
            continue;
          body += `<circle cx='${fmt(cx)}' cy='${fmt(cy)}' r='${fmt(r)}' fill='${fill}'/>`;
        }
    }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${fmt(width)}' height='${fmt(height)}'` +
    ` viewBox='0 0 ${fmt(width)} ${fmt(height)}'><defs>${defs}</defs>${body}</svg>`;
  return { svg, width, height };
}
