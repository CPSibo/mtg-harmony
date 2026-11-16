import type { Position } from '@vueuse/core';
import type { ScryfallCard } from '~/types/Scryfall';

export interface Battlefield {
  cardToAttach?: BoardCard;

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

export interface BoardCard {
  id: string;
  scryfallInfo: ScryfallCard;
  scryfall_uri: string;
  name: string;
  mana_cost: string;
  image_uri: string;
  modifiers: Set<BoardCardModifier>;
  tapped: boolean;
  stack?: BoardCardStack;
  faceNumber: number;
  /** Flipped over: shows its back face, or the standard card back. */
  flipped?: boolean;
  /** Turned 180� (Kamigawa flip cards). */
  turned?: boolean;
  /** Shows text if images are on, or art if they're off (#150). */
  imageSwapped?: boolean;
}

export interface Modifier {
  name: string;
  symbol: string; // mana-font CSS class (e.g. 'ms ms-ability-flying')
}

export interface BoardCardModifier {
  modifier: Modifier;
  count: number;
}
