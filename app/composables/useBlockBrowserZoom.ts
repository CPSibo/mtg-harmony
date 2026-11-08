import { useEventListener } from '@vueuse/core';
import type { MaybeRefOrGetter } from 'vue';

/**
 * Stops Safari zooming the page when a pinch starts on `target`. Safari
 * (iOS and macOS) fires its own non-standard gesture events for pinches, and
 * `touch-action` alone doesn't always stop the page zoom. The app's own
 * pinch handling uses touch events, so it keeps working.
 */
export function useBlockBrowserZoom(
  target: MaybeRefOrGetter<EventTarget | null | undefined>,
) {
  const cancel = (event: Event) => event.preventDefault();

  useEventListener(
    target,
    ['gesturestart', 'gesturechange', 'gestureend'],
    cancel,
    {
      passive: false,
    },
  );
}
