import type { ElementSize, Position } from '@vueuse/core';

/** A rectangle in board pixels. */
export interface Rect extends Position, ElementSize {}

/** Space kept between a new stack and its neighbours, in board pixels. */
const GAP = 16;

/** How much of a new stack must land inside the view. */
const MIN_VISIBLE_SHARE = 1 / 3;

export function overlaps(a: Rect, b: Rect) {
  return overlapArea(a, b) > 0;
}

function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The top-left corner for a new stack of `size`, with at least a third of it
 * inside `view`. Prefers a spot clear of all of `occupied`; with none, the
 * spot that overlaps them least, so cards cast into a full view spread out
 * rather than pile up. Ties go to the spot nearest the middle of the view.
 * Null when no spot shows enough of the stack.
 */
export function findFreeSpot(
  view: Rect,
  occupied: readonly Rect[],
  size: ElementSize,
): Position | null {
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
  // apart, flush with the view's edges, and flush with each neighbour. A
  // stack may hang up to two thirds off the view on each axis; the visible
  // share is checked per spot below.
  function candidates(axis: 'x' | 'y', span: 'width' | 'height') {
    const overhang = size[span] * (1 - MIN_VISIBLE_SHARE);
    const min = view[axis] - overhang;
    const max = view[axis] + view[span] - size[span] + overhang;
    const values = new Set([
      min,
      max,
      view[axis],
      view[axis] + view[span] - size[span],
    ]);
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
  const area = size.width * size.height;

  let best: Position | null = null;
  let bestOverlap = Infinity;
  let bestDistance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const rect = { x, y, ...size };
      if (overlapArea(rect, view) < area * MIN_VISIBLE_SHARE) continue;

      const distance = (x - middle.x) ** 2 + (y - middle.y) ** 2;
      if (bestOverlap === 0 && distance >= bestDistance) continue;

      let overlap = 0;
      for (const r of blocked) {
        overlap += overlapArea(r, rect);
        if (overlap > bestOverlap) break;
      }
      if (
        overlap < bestOverlap ||
        (overlap === bestOverlap && distance < bestDistance)
      ) {
        best = { x, y };
        bestOverlap = overlap;
        bestDistance = distance;
      }
    }
  }
  return best;
}
