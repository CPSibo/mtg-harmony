import { describe, expect, it } from 'vitest';
import { findFreeSpot, overlaps, type Rect } from '~/features/battlefield';

const size = { width: 100, height: 140 };
const view: Rect = { x: 0, y: 0, width: 1000, height: 600 };

const at = (x: number, y: number): Rect => ({ x, y, ...size });

describe('findFreeSpot', () => {
  it('puts the first card in the middle of an empty view', () => {
    expect(findFreeSpot(view, [], size)).toEqual({ x: 450, y: 230 });
  });

  it('puts cards cast in a row side by side, all in view, none overlapping', () => {
    const placed: Rect[] = [];
    for (let i = 0; i < 8; i++) {
      const spot = findFreeSpot(view, placed, size)!;
      const rect = at(spot.x, spot.y);
      expect(placed.some((r) => overlaps(r, rect))).toBe(false);
      expect(rect.x).toBeGreaterThanOrEqual(view.x);
      expect(rect.y).toBeGreaterThanOrEqual(view.y);
      expect(rect.x + rect.width).toBeLessThanOrEqual(view.x + view.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(view.y + view.height);
      placed.push(rect);
    }
  });

  it('keeps clear of stacks of any size', () => {
    const big: Rect = { x: 300, y: 100, width: 400, height: 400 };

    const spot = findFreeSpot(view, [big], size)!;

    expect(overlaps(big, at(spot.x, spot.y))).toBe(false);
  });

  it('finds nothing when the view is full', () => {
    expect(findFreeSpot(view, [view], size)).toBeNull();
  });

  it('finds nothing when the card is bigger than the view', () => {
    expect(
      findFreeSpot({ x: 0, y: 0, width: 50, height: 50 }, [], size),
    ).toBeNull();
  });
});
