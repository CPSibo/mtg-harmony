import { useSettingsStore } from '~/stores/settings';
import { useBattlefieldStore, type CopyMode } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import {
  cardImage,
  castSource,
  playCastAnimation,
  playMeldAnimation,
  playGraveyardAnimation,
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
 * Plays a card cast to the graveyard out of view (#175), unless cast
 * flights are turned off.
 */
export function useGraveyardAnimation() {
  const settings = useSettingsStore();
  return (source: CastSource | null) =>
    settings.castFlight === 'off'
      ? Promise.resolve()
      : playGraveyardAnimation(source, settings.castDuration);
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

/**
 * Melds and unmelds cards with a flourish (#204), unless turned off. On a
 * meld the other half flies onto the melded card, which bursts; on an unmeld
 * the second half slides out of it. Each returns what the store returns.
 */
export function useMeldAnimation() {
  const settings = useSettingsStore();
  const battlefield = useBattlefieldStore();

  function meld(card: BoardCard, result: ScryfallCard) {
    if (!settings.attachFlareEnabled) return battlefield.meld(card, result);
    // Measured now: the meld takes the other half off the board.
    const partner = battlefield.meldPartner(card);
    const source = partner ? castSource(cardImage(partner.id)) : null;
    const melded = battlefield.meld(card, result);
    if (melded) void playMeldAnimation(source, melded.id);
    return melded;
  }

  function unmeld(card: BoardCard) {
    const from = settings.attachFlareEnabled
      ? measureCards([card.id]).get(card.id)
      : undefined;
    const halves = battlefield.unmeld(card);
    if (halves && from) {
      const [first, second] = halves;
      void playMoveAnimation(new Map([[second.id, from]]), first.id, false);
    }
    return halves;
  }

  return { meld, unmeld };
}

/**
 * Creates a token, sliding it out from the card that made it (#204), unless
 * turned off. A source that's left the board just has the token appear.
 */
export function useTokenAnimation() {
  const settings = useSettingsStore();
  const battlefield = useBattlefieldStore();
  return (source: BoardCard, token: ScryfallCard) => {
    const from = settings.attachFlareEnabled
      ? measureCards([source.id]).get(source.id)
      : undefined;
    const stack = battlefield.createToken(source, token);
    if (from)
      void playMoveAnimation(
        new Map([[stack.primary.id, from]]),
        source.id,
        false,
      );
    return stack;
  };
}
