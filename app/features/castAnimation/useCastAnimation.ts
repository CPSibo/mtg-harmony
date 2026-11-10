import { useSettingsStore } from '~/stores/settings';
import {
  playAttachAnimation,
  playCastAnimation,
  playDetachAnimation,
  type CastSource,
} from './play';
import type { ScreenRect } from './keyframes';

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

/** Plays the detach/take-out flourish, unless turned off (#124). */
export function useDetachAnimation() {
  const settings = useSettingsStore();
  return (cardId: string, from: ScreenRect | null, hostId: string | null) => {
    if (settings.attachFlareEnabled)
      void playDetachAnimation(cardId, from, hostId);
  };
}
