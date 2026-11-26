import type { BoardColor } from './colors';
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

/** Board px per pixel of the spotlight bitmap. They're soft enough to scale up. */
export const SPOTLIGHT_PIXEL = 16;

/**
 * One block of spotlights as straight (not premultiplied) RGBA pixels, row by
 * row, `pixelWidth` × `pixelHeight` of them standing for `width` × `height`
 * board px.
 */
export interface SpotlightTile {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * The spotlights for a colour selection as one bitmap that repeats to the
 * board's edges (#246), or null with no colours. Spotlights sit in staggered
 * rows, colours running diagonally; the block that repeats is m × m
 * spotlights, m the smallest multiple of the colour count that's at least 3,
 * so the runs line up across blocks. Each is drawn again one block over
 * wherever it crosses an edge, so the tiles meet without seams; its radius is
 * capped at half the block so those copies are enough.
 *
 * One image, not a CSS gradient layer per spotlight: the browser can keep it
 * rasterised while panning, where 9 to 36 gradient layers repaint every frame.
 * Computed here, not drawn as SVG or canvas gradients: the browser dithers
 * those, and once the image is scaled the noise smears into faint stripes.
 * Plain pixels at low resolution scale up smoothly instead.
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

  const pixelWidth = Math.round(width / SPOTLIGHT_PIXEL);
  const pixelHeight = Math.round(height / SPOTLIGHT_PIXEL);
  // Board px per pixel, a little off SPOTLIGHT_PIXEL so whole pixels fill the block.
  const sx = width / pixelWidth;
  const sy = height / pixelHeight;
  // Premultiplied colour and alpha, composited source-over as SVG would.
  const rgb = new Float64Array(pixelWidth * pixelHeight * 3);
  const alpha = new Float64Array(pixelWidth * pixelHeight);

  const paint = (cx: number, cy: number, color: readonly number[]) => {
    const x0 = Math.max(0, Math.floor((cx - r) / sx));
    const x1 = Math.min(pixelWidth - 1, Math.ceil((cx + r) / sx));
    const y0 = Math.max(0, Math.floor((cy - r) / sy));
    const y1 = Math.min(pixelHeight - 1, Math.ceil((cy + r) / sy));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5) * sy - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5) * sx - cx;
        const t = Math.sqrt(dx * dx + dy * dy) / r;
        if (t >= 1) continue;
        // Full strength at the centre, 40 % halfway, none at the rim.
        const a = t < 0.5 ? p * (1 - 1.2 * t) : p * 0.8 * (1 - t);
        const i = y * pixelWidth + x;
        alpha[i] = a + alpha[i]! * (1 - a);
        for (let c = 0; c < 3; c++)
          rgb[i * 3 + c] = color[c]! * a + rgb[i * 3 + c]! * (1 - a);
      }
    }
  };

  const rgbOf = Object.fromEntries(
    colors.map((c) => [c, hexRgb(palette.colors[c])]),
  );
  for (let i = 0; i < m; i++)
    for (let j = 0; j < m; j++) {
      const color = rgbOf[colors[mod(i + j, n)]!]!;
      const x = (i + 0.5 * (j % 2)) * d;
      const y = j * d * ROW;
      for (const ox of [-width, 0, width])
        for (const oy of [-height, 0, height]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx + r <= 0 || cx - r >= width || cy + r <= 0 || cy - r >= height)
            continue;
          paint(cx, cy, color);
        }
    }

  const pixels = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]!;
    if (!a) continue;
    for (let c = 0; c < 3; c++) pixels[i * 4 + c] = rgb[i * 3 + c]! / a;
    pixels[i * 4 + 3] = a * 255;
  }
  return { width, height, pixelWidth, pixelHeight, pixels };
}

function hexRgb(color: string): number[] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}
