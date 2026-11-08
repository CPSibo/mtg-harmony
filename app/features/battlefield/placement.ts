import type { ElementSize, Position } from '@vueuse/core';

/** A rectangle in board pixels. */
export interface Rect extends Position, ElementSize {}

/** Space kept between a new stack and its neighbours, in board pixels. */
const GAP = 16;

/** How much of a new stack must land inside the view. */
const MIN_VISIBLE_SHARE = 0.75;

/** The step between layers of the spiral, in board pixels. */
const LAYER_OFFSET = 40;

export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function visibleArea(r: Rect, view: Rect) {
  const w =
    Math.min(r.x + r.width, view.x + view.width) - Math.max(r.x, view.x);
  const h =
    Math.min(r.y + r.height, view.y + view.height) - Math.max(r.y, view.y);
  return Math.max(0, w) * Math.max(0, h);
}

function grow(r: Rect, by: number): Rect {
  return {
    x: r.x - by,
    y: r.y - by,
    width: r.width + by * 2,
    height: r.height + by * 2,
  };
}

/** Slot offsets in rings around (0, 0), nearest first. */
function spiral(rings: number): Position[] {
  const slots: Position[] = [{ x: 0, y: 0 }];
  for (let ring = 1; ring <= rings; ring++) {
    const ringSlots: Position[] = [];
    for (let x = -ring; x <= ring; x++) {
      for (let y = -ring; y <= ring; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) === ring)
          ringSlots.push({ x, y });
      }
    }
    // Sides before corners.
    ringSlots.sort((a, b) => a.x ** 2 + a.y ** 2 - (b.x ** 2 + b.y ** 2));
    slots.push(...ringSlots);
  }
  return slots;
}

/**
 * Shifts for each layer of the spiral: multiples of {@link LAYER_OFFSET} on
 * each axis, under half a step, so no two layers coincide. No shift first,
 * then nearest first, down and right before up and left.
 */
function layerShifts(step: Position): Position[] {
  const offsets = (span: number) => {
    const n = Math.floor((span / 2 - 1) / LAYER_OFFSET);
    return Array.from({ length: n * 2 + 1 }, (_, i) => (i - n) * LAYER_OFFSET);
  };
  const shifts = offsets(step.x).flatMap((x) =>
    offsets(step.y).map((y) => ({ x, y })),
  );
  const rank = (p: Position) =>
    Math.max(Math.abs(p.x), Math.abs(p.y)) * 4 -
    Math.sign(p.x) -
    Math.sign(p.y);
  return shifts.sort((a, b) => rank(a) - rank(b));
}

/**
 * The top-left corner for a new stack of `size`: the first slot, spiralling
 * out from the middle of `view` in card-sized steps (plus a gap), that has
 * at least 75% of the card in view and doesn't overlap another stack. When the view has no such slot, the spiral
 * starts again shifted by a multiple of {@link LAYER_OFFSET} on each axis,
 * nearest shift first, so new cards sit offset from the ones below rather
 * than on top; a slot then only needs no stack already on that spot. Only
 * stacks that touch the view count.
 */
export function findFreeSpot(
  view: Rect,
  occupied: readonly Rect[],
  size: ElementSize,
): Position {
  const middle = {
    x: view.x + (view.width - size.width) / 2,
    y: view.y + (view.height - size.height) / 2,
  };
  if (size.width > view.width || size.height > view.height) return middle;

  const nearby = occupied.filter((r) => overlaps(grow(r, GAP), view));
  const step = { x: size.width + GAP, y: size.height + GAP };
  const rings =
    Math.ceil(Math.max(view.width / step.x, view.height / step.y) / 2) + 1;
  const slots = spiral(rings);
  const shifts = layerShifts(step);
  const area = size.width * size.height;

  for (const [layer, shift] of shifts.entries()) {
    for (const slot of slots) {
      const spot = {
        x: middle.x + slot.x * step.x + shift.x,
        y: middle.y + slot.y * step.y + shift.y,
      };
      const rect = { ...spot, ...size };
      if (visibleArea(rect, view) < area * MIN_VISIBLE_SHARE) continue;

      const taken =
        layer === 0
          ? nearby.some((r) => overlaps(r, rect))
          : nearby.some(
              (r) =>
                Math.abs(r.x - spot.x) < LAYER_OFFSET / 2 &&
                Math.abs(r.y - spot.y) < LAYER_OFFSET / 2,
            );
      if (!taken) return spot;
    }
  }
  return middle;
}
