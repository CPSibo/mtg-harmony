import type { InjectionKey, Ref } from 'vue';
import type { BoardCard } from '~/types/PlayArea';

/**
 * The card whose counter badges stay as they were, because its Modifiers
 * window covers the board (#204). Once the window has closed the badges
 * catch up, so their pop, shrink and bump play in view. The board provides
 * it and each board card reads it.
 */
export const BADGES_HELD: InjectionKey<Readonly<Ref<BoardCard | null>>> =
  Symbol('badgesHeld');
