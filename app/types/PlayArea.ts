import type { Position } from '@vueuse/core';
import type { ModifierKey } from '~/types/MtgConcepts';
import type { ScryfallCard } from '~/types/Scryfall';

export interface Battlefield {
  center: Position;
  stacks: BoardCardStack[];
  zOrder: string[];

  /** Pixel grid size for snapping board cards.
   *  Falsey to disable snapping. */
  snapScale: number;
}

export interface BoardCardStack {
  id: string;
  primary: BoardCard;
  position: Position;
  attachments: Set<BoardCard>;
  unders: Set<BoardCard>;
}

/**
 * One card on the board (or in On-deck). Its name, mana cost, image and link
 * come from `scryfallInfo`, not copies of them (#155): see `cardImage()`.
 */
export interface BoardCard {
  id: string;
  scryfallInfo: ScryfallCard;
  /** Counters and keywords, by key, with their counts (always above 0). */
  modifiers: Map<ModifierKey, number>;
  tapped: boolean;
  stack?: BoardCardStack;
  faceNumber: number;
  /** Flipped over: shows its back face, or the standard card back. */
  flipped?: boolean;
  /** Turned 180� (Kamigawa flip cards). */
  turned?: boolean;
  /** Shown as art or text whatever the setting says; unset follows it (#150). */
  shownAs?: 'art' | 'text';
}

export interface Modifier {
  /** What a saved card stores; never changes once shipped. */
  key: string;
  name: string;
  symbol: string; // mana-font CSS class (e.g. 'ms ms-ability-flying')
}
