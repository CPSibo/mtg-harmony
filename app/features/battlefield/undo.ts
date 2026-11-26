import { toRaw } from 'vue';
import type { Position } from '@vueuse/core';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

/** How many steps undo keeps (#215). Older ones are forgotten. */
export const UNDO_LIMIT = 50;

/** One stack as it was: which cards, where. */
interface StackLayout {
  id: string;
  position: Position;
  primary: BoardCard;
  attachments: BoardCard[];
  unders: BoardCard[];
}

/**
 * Which cards were in which stacks (#215), holding the cards themselves
 * rather than copies. Undo only reverses structural changes (cards arriving,
 * leaving or changing stacks), so restoring a layout keeps whatever happened
 * to its cards since: taps, counters, flips. Stacks still on the board keep
 * their current position; only stacks that left come back where they were.
 */
export interface BoardLayout {
  stacks: StackLayout[];
  zOrder: string[];
  /** Each melded card's halves, which unmeld clears (#143). */
  melds: Map<BoardCard, BoardCard['meldedFrom']>;
}

const raw = <T extends object>(value: T) => toRaw(value) as T;

export function captureLayout(
  stacks: readonly BoardCardStack[],
  zOrder: readonly string[],
): BoardLayout {
  const melds = new Map<BoardCard, BoardCard['meldedFrom']>();
  const layout = stacks.map((s) => {
    const stack: StackLayout = {
      id: s.id,
      position: { ...s.position },
      primary: raw(s.primary),
      attachments: [...s.attachments].map(raw),
      unders: [...s.unders].map(raw),
    };
    for (const card of [stack.primary, ...stack.attachments, ...stack.unders])
      if (card.meldedFrom) melds.set(card, card.meldedFrom);
    return stack;
  });
  return { stacks: layout, zOrder: [...zOrder], melds };
}

const sameCards = (a: readonly BoardCard[], b: readonly BoardCard[]) =>
  a.length === b.length && a.every((card, i) => card === b[i]);

/** Whether two layouts put the same cards in the same stacks. */
export function sameLayout(a: BoardLayout, b: BoardLayout): boolean {
  if (a.stacks.length !== b.stacks.length) return false;
  if (a.melds.size !== b.melds.size) return false;
  for (const [card, halves] of a.melds)
    if (b.melds.get(card) !== halves) return false;
  return a.stacks.every((s, i) => {
    const t = b.stacks[i]!;
    return (
      s.id === t.id &&
      s.primary === t.primary &&
      sameCards(s.attachments, t.attachments) &&
      sameCards(s.unders, t.unders)
    );
  });
}

/**
 * The z-order for a restored layout: the current order of stacks that stay,
 * with each returning stack slotted in after the one it followed before.
 */
function restoredZOrder(
  layout: BoardLayout,
  current: readonly string[],
): string[] {
  const kept = new Set(layout.stacks.map((s) => s.id));
  const order = current.filter((id) => kept.has(id));
  const present = new Set(order);
  layout.zOrder.forEach((id, i) => {
    if (present.has(id) || !kept.has(id)) return;
    let before: string | undefined;
    for (const prev of layout.zOrder.slice(0, i))
      if (present.has(prev)) before = prev;
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
    present.add(id);
  });
  return order;
}

/**
 * Puts the board back to `layout`. `current` are the board's stacks now,
 * through whatever proxy changes must go through to be seen (the store's
 * reactive ones); `wrap` gives the same for a card. Returns the stacks and
 * z-order to set.
 */
export function restoreLayout(
  layout: BoardLayout,
  current: readonly BoardCardStack[],
  zOrder: readonly string[],
  wrap: <T extends object>(value: T) => T,
): { stacks: BoardCardStack[]; zOrder: string[] } {
  const byId = new Map(current.map((s) => [s.id, s]));
  const placed = new Set<BoardCard>();

  const stacks = layout.stacks.map((saved) => {
    const stack: BoardCardStack = byId.get(saved.id) ?? {
      id: saved.id,
      position: { ...saved.position },
      primary: saved.primary,
      attachments: new Set(),
      unders: new Set(),
    };
    stack.primary = saved.primary;
    stack.attachments = new Set(saved.attachments);
    stack.unders = new Set(saved.unders);
    for (const card of [saved.primary, ...saved.attachments, ...saved.unders]) {
      wrap(card).stack = stack;
      placed.add(card);
    }
    return stack;
  });

  // Cards leaving the board belong to no stack, as removed cards don't.
  for (const stack of current)
    for (const card of [stack.primary, ...stack.attachments, ...stack.unders])
      if (!placed.has(raw(card))) card.stack = undefined;

  for (const card of placed) {
    const halves = layout.melds.get(card);
    if (card.meldedFrom !== halves) wrap(card).meldedFrom = halves;
  }

  return { stacks, zOrder: restoredZOrder(layout, zOrder) };
}
