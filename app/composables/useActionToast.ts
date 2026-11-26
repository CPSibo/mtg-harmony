import { useToast } from '@nuxt/ui/composables';
import type { Component } from 'vue';
import type { BoardCard } from '~/types/PlayArea';

/**
 * The info toast saying what an action did (#237), the same whether it ran
 * from the palette, a shortcut, the selection bar or a card's own buttons.
 * `id` names the action, so doing it again bumps the toast already showing
 * rather than stacking another: the palette and a card's button for the same
 * thing share one.
 */
export function useActionToast() {
  const toast = useToast();
  return (id: string, title: string, icon?: string | Component) =>
    toast.add({ id, title, icon, color: 'info', duration: 2500 });
}

/** "Grizzly Bears" for one card, "3 cards" for more: for toasts (#237). */
export function cardsLabel(cards: readonly BoardCard[]): string {
  return cards.length === 1
    ? cards[0]!.scryfallInfo.name
    : `${cards.length} cards`;
}
