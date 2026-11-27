import { describe, expect, it } from 'vitest';
import type { BoardColor } from '~/features/boardBackground/colors';
import {
  DARK_SPOTLIGHTS,
  LIGHT_SPOTLIGHTS,
  SPOTLIGHT_SPACING,
  spotlightTile,
  type SpotlightTile,
} from '~/features/boardBackground/spotlights';

/** One pixel's straight RGBA. */
function pixel(tile: SpotlightTile, x: number, y: number) {
  const i = (y * tile.pixelWidth + x) * 4;
  return [...tile.pixels.slice(i, i + 4)] as [number, number, number, number];
}

function hex(color: string) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

describe('spotlightTile', () => {
  it('has none when nothing is picked', () => {
    expect(spotlightTile([], DARK_SPOTLIGHTS)).toBeNull();
  });

  it.each<[BoardColor[], number]>([
    [['W'], 3],
    [['W', 'U'], 4],
    [['W', 'U', 'B'], 3],
    [['W', 'U', 'B', 'R', 'G', 'C'], 6],
  ])('repeats a block of m × m spotlights for %j', (colors, m) => {
    const tile = spotlightTile(colors, DARK_SPOTLIGHTS)!;
    expect(tile.width).toBe(m * SPOTLIGHT_SPACING);
    expect(tile.height).toBeCloseTo(m * SPOTLIGHT_SPACING * 0.87);
  });

  it('is a bitmap well below board resolution, sized to the block', () => {
    const tile = spotlightTile(['W', 'U', 'B'], DARK_SPOTLIGHTS)!;
    expect(tile.pixelWidth).toBeLessThan(tile.width / 4);
    expect(tile.pixelWidth / tile.pixelHeight).toBeCloseTo(
      tile.width / tile.height,
      1,
    );
    expect(tile.pixels).toHaveLength(tile.pixelWidth * tile.pixelHeight * 4);
  });

  it('meets itself without a seam where it repeats', () => {
    const tile = spotlightTile(['W', 'U', 'B'], DARK_SPOTLIGHTS)!;
    const { pixelWidth: w, pixelHeight: h } = tile;
    // Opposite edges are neighbours once tiled: they differ as little as any
    // two neighbours inside.
    for (let y = 0; y < h; y += 7)
      for (let c = 0; c < 4; c++)
        expect(
          Math.abs(pixel(tile, 0, y)[c]! - pixel(tile, w - 1, y)[c]!),
        ).toBeLessThanOrEqual(3);
    for (let x = 0; x < w; x += 7)
      for (let c = 0; c < 4; c++)
        expect(
          Math.abs(pixel(tile, x, 0)[c]! - pixel(tile, x, h - 1)[c]!),
        ).toBeLessThanOrEqual(3);
  });

  it('is smooth, with no dithering noise', () => {
    const tile = spotlightTile(['R', 'G'], DARK_SPOTLIGHTS)!;
    for (let y = 0; y < tile.pixelHeight; y++)
      for (let x = 1; x < tile.pixelWidth; x++)
        expect(
          Math.abs(pixel(tile, x, y)[3] - pixel(tile, x - 1, y)[3]),
        ).toBeLessThanOrEqual(1);
  });

  it('is strongest, in its own colour, at a spotlight’s centre', () => {
    const tile = spotlightTile(['R', 'G'], DARK_SPOTLIGHTS)!;
    // The first spotlight, red, sits on the block's top-left corner.
    const [r, g, , a] = pixel(tile, 0, 0);
    expect(r).toBeGreaterThan(g);
    expect(a).toBeGreaterThanOrEqual(
      Math.round(255 * DARK_SPOTLIGHTS.strength),
    );
    // Halfway to the next spotlight along the row.
    const mid = pixel(
      tile,
      Math.round(((SPOTLIGHT_SPACING / 2) * tile.pixelWidth) / tile.width),
      0,
    );
    expect(mid[3]).toBeLessThan(a);
  });

  it('uses only the colours picked', () => {
    const tile = spotlightTile(['R'], DARK_SPOTLIGHTS)!;
    const red = hex(DARK_SPOTLIGHTS.colors.R);
    for (let i = 0; i < tile.pixels.length; i += 4 * 97)
      if (tile.pixels[i + 3])
        expect([...tile.pixels.slice(i, i + 3)]).toEqual(red);
  });

  it('takes its colours and strength from the theme', () => {
    const dark = spotlightTile(['W'], DARK_SPOTLIGHTS)!;
    const light = spotlightTile(['W'], LIGHT_SPOTLIGHTS)!;
    expect(pixel(dark, 0, 0).slice(0, 3)).toEqual(hex('#f3e9c6'));
    expect(pixel(light, 0, 0).slice(0, 3)).toEqual(hex('#e0bf5c'));
    expect(pixel(light, 0, 0)[3]).toBeGreaterThan(pixel(dark, 0, 0)[3]);
  });
});
