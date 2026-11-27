import type { ElementSize, Position } from '@vueuse/core';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';
import { isLandscape, shownFaces } from './cardFaces';
import type { Rect } from './placement';

/**
 * The rows of a paper layout (#223), top of the board first: creatures in
 * front, lands at the back, everything else between.
 */
export type ArrangeRow = 'creatures' | 'other' | 'lands';
export const ARRANGE_ROWS: readonly ArrangeRow[] = [
  'creatures',
  'other',
  'lands',
];

/**
 * A card's row, by the face it shows. Anything that's a creature goes with
 * the creatures, land creatures and artifact creatures included, since they
 * fight. A face-down card is "other".
 */
export function arrangeRow(card: BoardCard): ArrangeRow {
  const types = shownFaces(card).map((f) => f.type_line ?? '');
  if (types.some((t) => /\bCreature\b/.test(t))) return 'creatures';
  if (types.some((t) => /\bLand\b/.test(t))) return 'lands';
  return 'other';
}

/** How far a stack's drawing runs past its measured box, each side. */
export interface Reach {
  left: number;
  right: number;
}

/*
 * Board pixels, measured at the default card size (#237). The box a stack
 * measures leaves out its badges, which hang right of the card, and the
 * overhang of a card lying sideways in a portrait-wide slot.
 */
/** How far a sideways card overhangs each side: half its long side less its short. */
const SIDEWAYS_OVERHANG = 35;
/** The space before the badges, and one column of them. */
const BADGE_OFFSET = 6;
const BADGE_COLUMN = 36;
/** Badges per column, beside the primary and beside an attachment. */
const PRIMARY_BADGE_ROWS = 5;
const ATTACHMENT_BADGE_ROWS = 3;

/**
 * How far `stack` draws past its box (#237), so arranged stacks leave room
 * for each other's badges and overhangs instead of the actions column of
 * the next stack landing on them.
 */
export function stackReach(stack: BoardCardStack): Reach {
  const { primary } = stack;
  const overhang =
    isLandscape(primary) !== primary.tapped ? SIDEWAYS_OVERHANG : 0;
  const columns = Math.max(
    Math.ceil(primary.modifiers.size / PRIMARY_BADGE_ROWS),
    ...[...stack.attachments].map((a) =>
      Math.ceil(a.modifiers.size / ATTACHMENT_BADGE_ROWS),
    ),
  );
  return {
    left: overhang,
    right: overhang + (columns ? BADGE_OFFSET + columns * BADGE_COLUMN : 0),
  };
}

interface ArrangeItem {
  id: string;
  row: ArrangeRow;
  size: ElementSize;
  position: Position;
  /** Room to leave either side, beyond `size`; none if missing. */
  reach?: Reach;
}

/**
 * Top-left corners that lay `items` out in their rows, from the area's
 * corner down: each row wraps at the area's width, keeps its cards'
 * left-to-right order, and starts below the last. Empty rows take no room.
 */
export function arrangeInRows(
  items: readonly ArrangeItem[],
  area: Position & { width: number },
  gap: number,
): Map<string, Position> {
  const at = new Map<string, Position>();
  // Cards keep their reading order: line by line, then left to right. A line
  // is cards whose tops are within the shortest card's height, so an
  // arranged layout reads back in the order it was laid out, and arranging
  // again changes nothing.
  const lineHeight = Math.min(...items.map((i) => i.size.height)) || 1;
  const line = (i: ArrangeItem) => Math.floor(i.position.y / lineHeight);
  let y = area.y;
  for (const row of ARRANGE_ROWS) {
    const cards = items
      .filter((i) => i.row === row)
      .sort((a, b) => line(a) - line(b) || a.position.x - b.position.x);
    if (!cards.length) continue;

    let x = area.x;
    let lineHeight = 0;
    for (const card of cards) {
      const left = card.reach?.left ?? 0;
      const width = left + card.size.width + (card.reach?.right ?? 0);
      if (x > area.x && x + width > area.x + area.width) {
        x = area.x;
        y += lineHeight + gap;
        lineHeight = 0;
      }
      at.set(card.id, { x: x + left, y });
      x += width + gap;
      lineHeight = Math.max(lineHeight, card.size.height);
    }
    // A wider gap between rows than between one row's lines.
    y += lineHeight + gap * 3;
  }
  return at;
}

/**
 * Lays `items` out in rows (`arrangeInRows`) at the width that shows them
 * biggest in a view of `aspect` (width / height) when zoomed to fit, centred
 * on `centre`. Returns top-left corners, as `arrangeInRows` does.
 */
export function arrangeToFit(
  items: readonly ArrangeItem[],
  centre: Position,
  aspect: number,
  gap: number,
): Map<string, Position> {
  if (!items.length) return new Map();
  const widths = items.map(
    (i) => (i.reach?.left ?? 0) + i.size.width + (i.reach?.right ?? 0) + gap,
  );
  // Wrap widths worth trying: room for at least n of the widest cards a
  // line, and for the n widest side by side, for every n.
  const candidates = new Set<number>();
  const widest = Math.max(...widths);
  let sum = 0;
  [...widths]
    .sort((a, b) => b - a)
    .forEach((w, i) => {
      sum += w;
      candidates.add(sum);
      candidates.add(widest * (i + 1));
    });

  let best: { at: Map<string, Position>; bounds: Rect; fit: number } | null =
    null;
  for (const width of candidates) {
    const at = arrangeInRows(items, { x: 0, y: 0, width }, gap);
    const bounds = boundsOf(items, at);
    const fit = Math.min(aspect / bounds.width, 1 / bounds.height);
    if (!best || fit > best.fit) best = { at, bounds, fit };
  }
  const { at, bounds } = best!;
  const dx = centre.x - (bounds.x + bounds.width / 2);
  const dy = centre.y - (bounds.y + bounds.height / 2);
  return new Map([...at].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }]));
}

/** The box round laid-out items, their reach included. */
function boundsOf(
  items: readonly ArrangeItem[],
  at: Map<string, Position>,
): Rect {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const i of items) {
    const p = at.get(i.id)!;
    left = Math.min(left, p.x - (i.reach?.left ?? 0));
    right = Math.max(right, p.x + i.size.width + (i.reach?.right ?? 0));
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y + i.size.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The part of the view a new card of `row` goes in when new cards are
 * arranged: the top third for creatures, the bottom third for lands, the
 * middle for the rest. Each band is at least `cardHeight` tall; in a short
 * view they overlap, but creatures and lands both stay in view.
 */
export function rowBand(row: ArrangeRow, view: Rect, cardHeight: number): Rect {
  const height = Math.max(view.height / 3, cardHeight);
  const y = {
    creatures: view.y,
    other: view.y + (view.height - height) / 2,
    lands: view.y + view.height - height,
  }[row];
  return { x: view.x, y, width: view.width, height };
}

/**
 * Top-left corners that lay `items` out in a grid of `columns` from
 * `origin` (#222), in reading order (top to bottom, then left to right).
 * Every cell is as big as the biggest item, with room for the most any of
 * them reaches either side (#237).
 */
export function arrangeInGrid(
  items: readonly Omit<ArrangeItem, 'row'>[],
  origin: Position,
  columns: number,
  gap: number,
): Map<string, Position> {
  const most = (f: (i: (typeof items)[number]) => number) =>
    Math.max(0, ...items.map(f));
  const cellWidth =
    most((i) => i.size.width) +
    most((i) => i.reach?.left ?? 0) +
    most((i) => i.reach?.right ?? 0) +
    gap;
  const cellHeight = Math.max(0, ...items.map((i) => i.size.height)) + gap;
  const ordered = [...items].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  return new Map(
    ordered.map((item, i) => [
      item.id,
      {
        x: origin.x + (i % columns) * cellWidth,
        y: origin.y + Math.floor(i / columns) * cellHeight,
      },
    ]),
  );
}
