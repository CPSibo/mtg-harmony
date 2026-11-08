import { describe, expect, it } from 'vitest';
import { findFreeSpot, overlaps, type Rect } from '~/features/battlefield';

const size = { width: 100, height: 140 };
const view: Rect = { x: 0, y: 0, width: 1000, height: 600 };

const at = (x: number, y: number): Rect => ({ x, y, ...size });

/** How much of `r` is inside `within`, from 0 to 1. */
function visibleShare(r: Rect, within: Rect = view) {
  const w =
    Math.min(r.x + r.width, within.x + within.width) - Math.max(r.x, within.x);
  const h =
    Math.min(r.y + r.height, within.y + within.height) -
    Math.max(r.y, within.y);
  return (Math.max(0, w) * Math.max(0, h)) / (r.width * r.height);
}

describe('findFreeSpot', () => {
  it('puts the first card in the middle of an empty view', () => {
    expect(findFreeSpot(view, [], size)).toEqual({ x: 450, y: 230 });
  });

  it('puts cards cast in a row side by side, at least a third in view, none overlapping', () => {
    const placed: Rect[] = [];
    for (let i = 0; i < 8; i++) {
      const spot = findFreeSpot(view, placed, size)!;
      const rect = at(spot.x, spot.y);
      expect(placed.some((r) => overlaps(r, rect))).toBe(false);
      expect(visibleShare(rect)).toBeGreaterThanOrEqual(1 / 3);
      placed.push(rect);
    }
  });

  it('fills a full view from the middle out, on screen, before hanging cards off it', () => {
    // A desktop view at the default zoom, filled about twice over.
    const desktop: Rect = { x: 0, y: 0, width: 1280, height: 677 };
    const card = { width: 200, height: 250 };
    const placed: Rect[] = [];

    for (let i = 0; i < 30; i++) {
      const spot = findFreeSpot(desktop, placed, card)!;
      placed.push({ ...spot, ...card });
    }

    for (const r of placed) {
      expect(visibleShare(r, desktop)).toBeGreaterThan(0.95);
    }
    const spots = new Set(placed.map((r) => `${r.x},${r.y}`));
    expect(spots.size).toBe(placed.length);
  });

  it('keeps clear of stacks of any size', () => {
    const big: Rect = { x: 300, y: 100, width: 400, height: 400 };

    const spot = findFreeSpot(view, [big], size)!;

    expect(overlaps(big, at(spot.x, spot.y))).toBe(false);
  });

  it('with the view full, lands where it overlaps least, so cards spread out', () => {
    // Four cards filling a small view, meeting in its middle.
    const small: Rect = { x: 0, y: 0, width: 200, height: 280 };
    const placed: Rect[] = [at(0, 0), at(100, 0), at(0, 140), at(100, 140)];

    const first = findFreeSpot(small, placed, size)!;
    placed.push(at(first.x, first.y));
    const second = findFreeSpot(small, placed, size)!;

    expect(first).not.toEqual(second);
    expect(visibleShare(at(second.x, second.y), small)).toBeGreaterThanOrEqual(
      1 / 3,
    );
  });

  it('finds nothing when the card is bigger than the view', () => {
    expect(
      findFreeSpot({ x: 0, y: 0, width: 50, height: 50 }, [], size),
    ).toBeNull();
  });
});
