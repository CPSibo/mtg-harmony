import type { ElementSize, Position } from '@vueuse/core';

/** A rectangle in board pixels. */
export interface Rect extends Position, ElementSize {}

/** Space kept between a new stack and its neighbours, in board pixels. */
const GAP = 16;

export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * The top-left corner for a new stack of `size` inside `view` that overlaps
 * none of `occupied`, nearest the middle of the view. Null when there's no
 * such spot.
 */
export function findFreeSpot(
  view: Rect,
  occupied: readonly Rect[],
  size: ElementSize,
): Position | null {
  if (size.width > view.width || size.height > view.height) return null;

  const blocked = occupied.map((r) => ({
    x: r.x - GAP,
    y: r.y - GAP,
    width: r.width + GAP * 2,
    height: r.height + GAP * 2,
  }));

  const middle = {
    x: view.x + (view.width - size.width) / 2,
    y: view.y + (view.height - size.height) / 2,
  };
  const step = Math.max(10, Math.min(size.width, size.height) / 4);

  // Candidates on each axis: a grid from the view's middle a quarter card
  // apart, flush with the view's edges, and flush with each neighbour.
  function candidates(axis: 'x' | 'y', span: 'width' | 'height') {
    const min = view[axis];
    const max = view[axis] + view[span] - size[span];
    const values = new Set([min, max]);
    for (let v = middle[axis]; v >= min; v -= step) values.add(v);
    for (let v = middle[axis]; v <= max; v += step) values.add(v);
    for (const r of blocked) {
      values.add(r[axis] + r[span]);
      values.add(r[axis] - size[span]);
    }
    return [...values].filter((v) => v >= min && v <= max);
  }

  const xs = candidates('x', 'width');
  const ys = candidates('y', 'height');

  let best: Position | null = null;
  let bestDistance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const spot = { x, y };
      const distance = (x - middle.x) ** 2 + (y - middle.y) ** 2;
      if (distance >= bestDistance) continue;
      if (blocked.some((r) => overlaps(r, { ...spot, ...size }))) continue;
      best = spot;
      bestDistance = distance;
    }
  }
  return best;
}
