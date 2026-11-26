import { describe, expect, it } from 'vitest';
import {
  DARK_PALETTE,
  type BoardColor,
} from '~/features/boardBackground/colors';
import {
  buildTile,
  CELL,
  motifLayout,
  svgUrl,
} from '~/features/boardBackground/tile';

/** Each placed motif: the cell centre it's drawn at, and its key. */
function placed(svg: string) {
  const clip = 0.56 * CELL;
  return [
    ...svg.matchAll(
      /translate\((-?[\d.]+) (-?[\d.]+)\)[^>]*><use href='#m(\w)'\/>/g,
    ),
  ].map((m) => ({
    x: Number(m[1]) + clip,
    y: Number(m[2]) + clip,
    key: m[3],
  }));
}

describe('buildTile', () => {
  it.each<[string, BoardColor[]]>([
    ['nothing', []],
    ['one colour', ['G']],
    ['two colours', ['W', 'U']],
    ['three colours', ['W', 'U', 'B']],
    ['all six', ['W', 'U', 'B', 'R', 'G', 'C']],
  ])('places the right motif in every cell for %s', (_, colors) => {
    const { svg, size } = buildTile(colors, DARK_PALETTE);
    const layout = motifLayout(colors);
    const cells = placed(svg);
    const inside = cells.filter(
      (c) => c.x >= 0 && c.x < size && c.y >= 0 && c.y < size,
    );
    // One cell per two lattice points in the block.
    expect(inside).toHaveLength((layout.size * layout.size) / 2);
    for (const c of cells) {
      const u = Math.round(c.x / CELL);
      const v = Math.round(c.y / CELL);
      expect(c.key).toBe(layout.at(u, v));
    }
  });

  it('places one <use> per cell, each cell once', () => {
    const { svg } = buildTile(['W', 'U', 'B'], DARK_PALETTE);
    const cells = placed(svg).map((c) => `${c.x},${c.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(svg.match(/<use /g)).toHaveLength(cells.length);
  });

  it('shows the blank slot when nothing is picked', () => {
    const { svg } = buildTile([], DARK_PALETTE);
    expect(new Set(placed(svg).map((c) => c.key))).toEqual(new Set(['N']));
  });

  it('defines each motif once', () => {
    const { svg } = buildTile(['R', 'G', 'C'], DARK_PALETTE);
    for (const key of ['R', 'G', 'C'])
      expect(svg.match(new RegExp(`<g id='m${key}'`, 'g'))).toHaveLength(1);
    expect(svg).not.toContain(`id='mW'`);
  });

  it('repeats a block twice the shuffle period wide', () => {
    expect(buildTile(['W', 'U', 'B'], DARK_PALETTE).size).toBe(8 * CELL);
    expect(buildTile(['W'], DARK_PALETTE).size).toBe(2 * CELL);
  });
});

describe('svgUrl', () => {
  it('escapes what a data URI needs and nothing else', () => {
    expect(svgUrl(`<svg fill='url(#a)'>%</svg>`)).toBe(
      `url("data:image/svg+xml,%3Csvg fill='url(%23a)'%3E%25%3C/svg%3E")`,
    );
  });
});
