import type { BoardCard } from "~/types/PlayArea";

export interface Graveyard {
  removeCounters: boolean;
  cards: BoardCard[];
}