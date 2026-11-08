import type { ElementSize, Position } from '@vueuse/core';

/** A rectangle in board pixels. */
export interface Rect extends Position, ElementSize {}

/** Space kept between a new stack and its neighbours, in board pixels. */
const GAP = 16;

/** How much of a new stack must land inside the view. */
const MIN_VISIBLE_SHARE = 1 / 3;

/** Cost of a unit of area within the gap around a stack. */
const GAP_COST = 1;

/**
 * Extra cost, in card areas, of covering a whole stack. It grows with the
 * fourth power of the share covered, so a little overlap costs next to
 * nothing and hiding a card costs a lot.
 */
const HIDE_COST = 8;

export function overlaps(a: Rect, b: Rect) {
  return overlapArea(a, b) > 0;
}

function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * How much worse a unit of card area off screen is than one covering another
 * stack. High, so a full view fills well past one card deep, on screen,
 * before cards start to hang off its edges. Tuned by filling desktop and
 * phone views with 30 cards.
 */
const OFFSCREEN_COST = 12;

/**
 * The cost, in card areas, of being as far from the view's middle as its
 * corner. Keeps placement working from the middle out.
 */
const DISTANCE_COST = 0.5;

/**
 * The top-left corner for a new stack of `size`, with at least a third of it
 * inside `view`. Each spot costs what it covers of `occupied` (more for
 * hiding most of one stack), plus {@link OFFSCREEN_COST} times its area off
 * screen, plus a little for its distance from the middle. So it takes a free
 * spot in view if there is one, nearest the middle, and fills a full view
 * from the middle out, offset from the cards already there. Null when no spot
 * shows enough of the stack.
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

  const maxDistance = Math.hypot(view.width / 2, view.height / 2) || 1;

  let best: Position | null = null;
  let bestCost = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const rect = { x, y, ...size };
      const shown = overlapArea(rect, view);
      if (shown < area * MIN_VISIBLE_SHARE) continue;

      let cost =
        (area - shown) * OFFSCREEN_COST +
        (Math.hypot(x - middle.x, y - middle.y) / maxDistance) *
          area *
          DISTANCE_COST;
      // Covering a stack costs its covered area, plus HIDE_COST for covering
      // most of it. Coming within the gap costs a little.
      for (const [i, r] of occupied.entries()) {
        if (cost >= bestCost) break;
        const covered = overlapArea(r, rect);
        const share = covered / (r.width * r.height);
        const nearby = overlapArea(blocked[i]!, rect) - covered;
        cost += covered + share ** 4 * area * HIDE_COST + nearby * GAP_COST;
      }
      if (cost < bestCost) {
        best = { x, y };
        bestCost = cost;
      }
    }
  }
  return best;
}
