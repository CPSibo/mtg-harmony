import type { BoardCard } from '~/types/PlayArea';

export interface GraveyardState {
  /**********************
    State
  **********************/
  cards: BoardCard[];

  graveyardWindowButtonIsVisible: boolean;
  graveyardWindowIsOpen: boolean;

  addCardToGraveyardWindowIsOpen: boolean;

  /**********************
    Settings
  **********************/
  removeCounters: boolean;
}
