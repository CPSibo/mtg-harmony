import { describe, expect, it } from 'vitest';
import type { BoardColor } from '~/features/boardBackground/colors';
import {
  DARK_SPOTLIGHTS,
  LIGHT_SPOTLIGHTS,
  SPOTLIGHT_SPACING,
  spotlightTile,
} from '~/features/boardBackground/spotlights';

/** Each spotlight drawn: centre and gradient colour key. */
function circles(svg: string) {
  return [
    ...svg.matchAll(
      /<circle cx='(-?[\d.]+)' cy='(-?[\d.]+)' r='([\d.]+)' fill='url\(#s(\w)\)'/g,
    ),
  ].map((m) => ({ x: +m[1]!, y: +m[2]!, r: +m[3]!, key: m[4] }));
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
    const inside = circles(tile.svg).filter(
      (c) => c.x >= 0 && c.x < tile.width && c.y >= 0 && c.y < tile.height,
    );
    expect(inside).toHaveLength(m * m);
  });

  it('draws a copy one block over wherever a spotlight crosses an edge', () => {
    const tile = spotlightTile(['W', 'U', 'B'], DARK_SPOTLIGHTS)!;
    const all = circles(tile.svg);
    for (const c of all.filter((c) => c.x - c.r < 0))
      expect(
        all.some(
          (o) => Math.abs(o.x - (c.x + tile.width)) < 0.2 && o.y === c.y,
        ),
      ).toBe(true);
  });

  it('runs the colours diagonally and uses only those picked', () => {
    const tile = spotlightTile(['R', 'G'], DARK_SPOTLIGHTS)!;
    expect(new Set(circles(tile.svg).map((c) => c.key))).toEqual(
      new Set(['R', 'G']),
    );
    expect(tile.svg).not.toContain(`id='sW'`);
  });

  it('takes its colours and strength from the theme', () => {
    expect(spotlightTile(['W'], DARK_SPOTLIGHTS)!.svg).toContain(
      `stop-color='#f3e9c6' stop-opacity='0.08'`,
    );
    expect(spotlightTile(['W'], LIGHT_SPOTLIGHTS)!.svg).toContain(
      `stop-color='#e0bf5c' stop-opacity='0.1'`,
    );
  });
});
