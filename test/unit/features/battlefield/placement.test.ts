import { describe, expect, it } from 'vitest';
import { findFreeSpot, overlaps, type Rect } from '~/features/battlefield';

const size = { width: 100, height: 140 };
const view: Rect = { x: 0, y: 0, width: 1000, height: 600 };

const at = (x: number, y: number): Rect => ({ x, y, ...size });

/** At least 75% of `r` is inside `within`. */
function inside(r: Rect, within: Rect = view) {
  const w =
    Math.min(r.x + r.width, within.x + within.width) - Math.max(r.x, within.x);
  const h =
    Math.min(r.y + r.height, within.y + within.height) -
    Math.max(r.y, within.y);
  return Math.max(0, w) * Math.max(0, h) >= r.width * r.height * 0.75;
}

describe('findFreeSpot', () => {
  it('puts the first card in the middle of an empty view', () => {
    expect(findFreeSpot(view, [], size)).toEqual({ x: 450, y: 230 });
  });

  it('puts cards cast in a row side by side, in view, none overlapping', () => {
    const placed: Rect[] = [];
    for (let i = 0; i < 8; i++) {
      const spot = findFreeSpot(view, placed, size);
      const rect = at(spot.x, spot.y);
      expect(placed.some((r) => overlaps(r, rect))).toBe(false);
      expect(inside(rect)).toBe(true);
      placed.push(rect);
    }
  });

  it('spirals out from the middle', () => {
    const placed: Rect[] = [];
    const distances: number[] = [];
    for (let i = 0; i < 9; i++) {
      const spot = findFreeSpot(view, placed, size);
      placed.push(at(spot.x, spot.y));
      distances.push(Math.max(Math.abs(spot.x - 450), Math.abs(spot.y - 230)));
    }

    // The first card, then the eight around it.
    expect(distances[0]).toBe(0);
    expect(distances.slice(1).every((d) => d > 0 && d < 200)).toBe(true);
  });

  it('keeps clear of stacks of any size', () => {
    const big: Rect = { x: 300, y: 100, width: 400, height: 400 };

    const spot = findFreeSpot(view, [big], size);

    expect(overlaps(big, at(spot.x, spot.y))).toBe(false);
  });

  it('uses an edge slot when at least 75% of the card shows', () => {
    // Slots from the middle at x = 450 ± 116: the one at 914 is 86% in view.
    const placed: Rect[] = [];
    for (let i = 0; i < 40; i++) {
      const spot = findFreeSpot(view, placed, size);
      placed.push(at(spot.x, spot.y));
    }

    expect(placed.some((r) => r.x + r.width > view.x + view.width)).toBe(true);
  });

  it('ignores stacks outside the view', () => {
    const far: Rect = { x: 5000, y: 5000, width: 100, height: 140 };

    expect(findFreeSpot(view, [far], size)).toEqual({ x: 450, y: 230 });
  });

  it('with the view full, starts again offset, so no card lands on another', () => {
    // A desktop view at the default zoom, filled about twice over.
    const desktop: Rect = { x: 0, y: 0, width: 1280, height: 677 };
    const card = { width: 200, height: 250 };
    const placed: Rect[] = [];

    for (let i = 0; i < 30; i++) {
      const spot = findFreeSpot(desktop, placed, card);
      placed.push({ ...spot, ...card });
    }

    for (const r of placed) expect(inside(r, desktop)).toBe(true);
    const spots = new Set(placed.map((r) => `${r.x},${r.y}`));
    expect(spots.size).toBe(placed.length);
  });

  it('centres a card bigger than the view', () => {
    const small: Rect = { x: 0, y: 0, width: 50, height: 50 };

    expect(findFreeSpot(small, [], size)).toEqual({ x: -25, y: -45 });
  });
});
