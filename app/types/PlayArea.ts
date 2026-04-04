import type { Position } from '@vueuse/core';
import type { ScryfallCard } from '~/types/Scryfall';

export interface Battlefield {
  cardToAttach?: BoardCard;

  center: Position;
  stacks: BoardCardStack[];
}

export interface BoardCardStack {
  id: string;
  primary: BoardCard;
  position: Position;
  attachments: BoardCard[];
  unders: BoardCard[];
  counter: number;
}

export interface BoardCard {
  id: string;
  scryfallInfo: ScryfallCard;
  scryfall_uri: string;
  name: string;
  mana_cost: string;
  image_uri: string;
  modifiers: BoardCardModifier[];
  tapped: boolean;
  stack?: BoardCardStack;
}

export interface Modifier {
  name: string;
  symbol: string; // mana-font CSS class (e.g. 'ms ms-ability-flying')
}

export interface BoardCardModifier {
  modifier: Modifier;
  count: number;
}
