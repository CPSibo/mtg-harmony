import { useSettingsStore } from '~/stores/settings';
import {
  playCastAnimation,
  measureCards,
  playMoveAnimation,
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
