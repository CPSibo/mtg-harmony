import type { BoardColor, BoardPalette, MotifKey } from './colors';
import { fmt, rhombus } from './geometry';
import { motifBody } from './motifs';
import { mod, shuffleLayout } from './shuffle';

/** Half a lattice cell's diagonal, in board px. */
export const CELL = 150;
/** The shuffled block is 2 × PERIOD cells square. */
export const PERIOD = 4;
/** Fixed so the board looks the same on every load. */
export const SEED = 7;

/** The inner diamonds' strength and width, relative to the main lines. */
const INNER_STRENGTH = 0.7;
const INNER_WIDTH = 0.8;
/** The gem knots' size and strength, relative to the tuned defaults. */
const GEM_SIZE = 0.9;
const GEM_STRENGTH = 0.8;
/** How much wider the clearing round each gem is than a flush fit. */
const GEM_PADDING = 2;

/**
 * Which motif each lattice cell (u, v) shows, u + v even, and the size of the
 * block that repeats, in cells (#246). Nothing picked is the blank slot
 * everywhere; one colour fills every cell; two make a checkerboard; more are
 * shuffled so no neighbours match.
 */
export function motifLayout(colors: readonly BoardColor[]): {
  size: number;
  at(u: number, v: number): MotifKey;
} {
  if (colors.length < 2) {
    const only: MotifKey = colors[0] ?? 'N';
    return { size: 2, at: () => only };
  }
  const layout = shuffleLayout(colors.length, PERIOD, SEED);
  return { size: layout.size, at: (u, v) => colors[layout.at(u, v)]! };
}

export interface Tile {
  svg: string;
  /** The tile's width and height in board px; it's square. */
  size: number;
}

/**
 * The lattice tile for a colour selection and theme: one SVG that repeats
 * seamlessly (#246). Each motif is defined once and placed with `<use>`, and
 * each cell draws the knot at its top corner, so cells overlapping the edges
 * complete the ones beside them.
 */
export function buildTile(
  colors: readonly BoardColor[],
  palette: BoardPalette,
): Tile {
  const { size: cells, at } = motifLayout(colors);
  const used = [...new Set<MotifKey>(colors.length ? colors : ['N'])];
  const h = CELL;
  const size = cells * h;
  const { neutral, lines, motifs } = palette;

  const ring = 0.6 * h;
  const clip = 0.56 * h;
  const scale = (2 * clip) / 200;
  const stroke = h * 0.012;
  const gem = h * 0.05 * GEM_SIZE;
  const gemW = gem * 1.2;
  const gemH = gem * 1.7;
  const flush = (1 / (1 / gemW + 1 / gemH)) * Math.SQRT2;
  const gap = flush + (gemH - flush) * GEM_PADDING;

  let defs = `<clipPath id='m'><circle cx='100' cy='100' r='100'/></clipPath>`;
  for (const key of used)
    defs +=
      `<radialGradient id='f${key}' gradientUnits='userSpaceOnUse' cx='100' cy='100' r='100'>` +
      `<stop offset='0' stop-color='${palette.ink[key]}'/>` +
      `<stop offset='.45' stop-color='${palette.ink[key]}'/>` +
      `<stop offset='1' stop-color='${neutral}'/></radialGradient>` +
      `<g id='m${key}' fill='url(#f${key})'>${motifBody(key)}</g>`;

  let outer = '';
  let inner = '';
  let gaps = '';
  let gems = '';
  let rings = '';
  let motifUses = '';
  const reach = cells + 2;
  for (let u = -2; u <= reach; u++)
    for (let v = -2; v <= reach + 1; v++) {
      if (mod(u + v, 2)) continue;
      const x = u * h;
      const y = v * h;
      if (x < -h || x > size + h || y < -h || y > size + 2 * h) continue;
      outer += `M${fmt(x - h)} ${fmt(y)}L${fmt(x)} ${fmt(y - h)}L${fmt(x + h)} ${fmt(y)}`;
      inner += rhombus(x, y, 0.9 * h, 0.9 * h);
      gaps += `<circle cx='${fmt(x)}' cy='${fmt(y - h)}' r='${fmt(gap)}'/>`;
      gems += rhombus(x, y - h, gemW, gemH);
      rings += `<circle cx='${fmt(x)}' cy='${fmt(y)}' r='${fmt(ring)}'/>`;
      motifUses +=
        `<g transform='translate(${fmt(x - clip)} ${fmt(y - clip)}) scale(${scale.toFixed(4)})'` +
        ` clip-path='url(#m)'><use href='#m${at(u, v)}'/></g>`;
    }

  const m = -2 * h;
  const span = size + 4 * h;
  defs +=
    `<mask id='gap' maskUnits='userSpaceOnUse' x='${m}' y='${m}' width='${span}' height='${span}'>` +
    `<rect x='${m}' y='${m}' width='${span}' height='${span}' fill='white'/>` +
    `<g fill='black'>${gaps}</g></mask>`;

  const sw = fmt(stroke);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'` +
    ` fill='none' stroke-linecap='round' stroke-linejoin='round'><defs>${defs}</defs>` +
    `<g stroke='${neutral}' stroke-width='${sw}'>` +
    `<path mask='url(#gap)' d='${outer}' stroke-opacity='${lines}'/>` +
    `<path d='${inner}' stroke-opacity='${(lines * INNER_STRENGTH).toFixed(3)}'` +
    ` stroke-width='${(stroke * INNER_WIDTH).toFixed(2)}'/>` +
    `<path d='${gems}' stroke-opacity='${Math.min(1, lines * GEM_STRENGTH).toFixed(3)}'/></g>` +
    `<g stroke='${neutral}' stroke-opacity='${lines}' stroke-width='${sw}'>${rings}</g>` +
    `<g opacity='${motifs}'>${motifUses}</g>` +
    `</svg>`;
  return { svg, size };
}

/** An SVG as a CSS `url()`, escaping only what a data URI needs. */
export const svgUrl = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/[%#<>"\n]/g, encodeURIComponent)}")`;
