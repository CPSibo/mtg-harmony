import { useSettingsStore } from '~/stores/settings';
import { useBattlefieldStore, type CopyMode } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';
import {
  playCastAnimation,
  measureCards,
  playMoveAnimation,
  playRemoveAnimation,
  type CastSource,
} from './play';

/** Plays the cast animation with the user's chosen style (#124). */
export function useCastAnimation() {
  const settings = useSettingsStore();
  return (stackId: string, source: CastSource | null) =>
    playCastAnimation(stackId, source, {
      flight: settings.castFlight,
      landing: settings.castLanding,
      duration: settings.castDuration,
    });
}

/**
 * Animates cards moving between stacks (#124), unless turned off: call
 * with the cards before the change, then call what it returns after it.
 */
export function useMoveAnimation() {
  const settings = useSettingsStore();
  return (cardIds: readonly string[]) => {
    if (!settings.attachFlareEnabled) return () => {};
    const from = measureCards(cardIds);
    return (hostId: string | null, joining: boolean) =>
      void playMoveAnimation(from, hostId, joining);
  };
}

/** Copies a card, sliding the copy out from its source (#124). */
export function useCopyAnimation() {
  const settings = useSettingsStore();
  const battlefield = useBattlefieldStore();
  return (card: BoardCard, mode: CopyMode) => {
    const sourceId =
      mode === 'stack' && card.stack ? card.stack.primary.id : card.id;
    const from = settings.attachFlareEnabled
      ? measureCards([sourceId]).get(sourceId)
      : undefined;
    const copy = battlefield.copyCard(card, mode);
    if (from)
      void playMoveAnimation(
        new Map([[copy.primary.id, from]]),
        sourceId,
        false,
      );
    return copy;
  };
}

/**
 * Removes a card after playing it out (#124). Cards freed by removing a
 * stack's primary slide to their new spots.
 */
export function useRemoveAnimation() {
  const settings = useSettingsStore();
  const battlefield = useBattlefieldStore();
  return async (card: BoardCard) => {
    if (!settings.attachFlareEnabled) {
      battlefield.removeCard(card);
      return;
    }
    const stack = card.stack;
    const freed =
      stack && stack.primary === card
        ? [...stack.attachments, ...stack.unders].map((c) => c.id)
        : [];
    const from = measureCards(freed);
    await playRemoveAnimation(card.id);
    battlefield.removeCard(card);
    if (from.size) void playMoveAnimation(from, null, false);
  };
}
