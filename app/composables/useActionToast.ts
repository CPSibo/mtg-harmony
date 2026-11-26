import { useToast } from '@nuxt/ui/composables';
import type { Component } from 'vue';
import type { BoardCard } from '~/types/PlayArea';
import { useBattlefieldStore } from '~/features/battlefield/store';

/**
 * The info toast saying what an action did (#237), the same whether it ran
 * from the palette, a shortcut, the selection bar or a card's own buttons.
 * `id` names the action, so doing it again bumps the toast already showing
 * rather than stacking another: the palette and a card's button for the same
 * thing share one.
 */
export function useActionToast() {
  const toast = useToast();
  const battlefield = useBattlefieldStore();
  /**
   * `undoable` actions (structural ones, #215) get an Undo button, which
   * undoes the newest step as Ctrl+Z does, and stay a little longer.
   */
  return (
    id: string,
    title: string,
    icon?: string | Component,
    undoable = false,
  ) =>
    toast.add({
      id,
      title,
      icon,
      color: 'info',
      duration: undoable ? 5000 : 2500,
      ...(undoable && { actions: [undoAction(battlefield)] }),
    });
}

/** The Undo button on an action's toast (#215). */
export function undoAction(battlefield: { undo: () => boolean }) {
  return {
    label: 'Undo',
    icon: 'i-lucide-undo-2',
    color: 'neutral' as const,
    variant: 'outline' as const,
    onClick: () => void battlefield.undo(),
  };
}

/** "Grizzly Bears" for one card, "3 cards" for more: for toasts (#237). */
export function cardsLabel(cards: readonly BoardCard[]): string {
  return cards.length === 1
    ? cards[0]!.scryfallInfo.name
    : `${cards.length} cards`;
}
