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
  let y = area.y;
  for (const row of ARRANGE_ROWS) {
    const cards = items
      .filter((i) => i.row === row)
      .sort(
        (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
      );
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
