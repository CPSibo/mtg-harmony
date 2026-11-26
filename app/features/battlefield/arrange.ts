import type { ElementSize, Position } from '@vueuse/core';
import type { BoardCard } from '~/types/PlayArea';
import { shownFaces } from './cardFaces';
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

interface ArrangeItem {
  id: string;
  row: ArrangeRow;
  size: ElementSize;
  position: Position;
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
      if (x > area.x && x + card.size.width > area.x + area.width) {
        x = area.x;
        y += lineHeight + gap;
        lineHeight = 0;
      }
      at.set(card.id, { x, y });
      x += card.size.width + gap;
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
