import { describe, expect, it } from 'vitest';
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  type BoardColor,
} from '~/features/boardBackground/colors';
import { emblemBody } from '~/features/boardBackground/emblems';
import {
  buildTile,
  CELL,
  emblemPreview,
  motifLayout,
  svgDataUri,
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

describe('buildTile emblem styles (#250)', () => {
  it('draws art deco unless told otherwise', () => {
    expect(buildTile(['R'], DARK_PALETTE).svg).toBe(
      buildTile(['R'], DARK_PALETTE, 'deco').svg,
    );
  });

  it('draws each motif in the style asked for', () => {
    const deco = buildTile(['R'], DARK_PALETTE, 'deco').svg;
    const coin = buildTile(['R'], DARK_PALETTE, 'manaCoin').svg;
    expect(deco).toContain(emblemBody('deco', 'R'));
    expect(coin).toContain(emblemBody('manaCoin', 'R'));
    expect(coin).not.toContain(emblemBody('deco', 'R'));
  });

  it('lets outlines take the motif colour', () => {
    const { svg } = buildTile(['U'], DARK_PALETTE, 'manaOutline');
    expect(svg).toContain(
      `<g id='mU' fill='url(#fU)' stroke='url(#fU)' stroke-width='0'>`,
    );
  });
});

describe('emblemPreview', () => {
  it('draws one medallion in the theme ink for the colour', () => {
    const svg = emblemPreview('stars', 'G', LIGHT_PALETTE);
    expect(svg).toContain(emblemBody('stars', 'G'));
    expect(svg).toContain(`stop-color='${LIGHT_PALETTE.ink.G}'`);
    expect(svg.match(/<svg /g)).toHaveLength(1);
  });
});

describe('svgDataUri', () => {
  it('is the data URI inside svgUrl', () => {
    const svg = `<svg fill='url(#a)'>%</svg>`;
    expect(svgUrl(svg)).toBe(`url("${svgDataUri(svg)}")`);
  });
});

describe('svgUrl', () => {
  it('escapes what a data URI needs and nothing else', () => {
    expect(svgUrl(`<svg fill='url(#a)'>%</svg>`)).toBe(
      `url("data:image/svg+xml,%3Csvg fill='url(%23a)'%3E%25%3C/svg%3E")`,
    );
  });
});
