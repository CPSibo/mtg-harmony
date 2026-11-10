import { useSettingsStore } from '~/stores/settings';
import {
  playAttachAnimation,
  playCastAnimation,
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

/** Plays the attach/under flourish, unless turned off (#124). */
export function useAttachAnimation() {
  const settings = useSettingsStore();
  return (cardId: string, targetId: string) => {
    if (settings.attachFlareEnabled) void playAttachAnimation(cardId, targetId);
  };
}
