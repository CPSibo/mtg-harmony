import { useDocumentVisibility, useWakeLock } from '@vueuse/core';
import { watch } from 'vue';
import { useSettingsStore } from '~/stores/settings';

/**
 * Keeps the screen awake while "Keep screen awake" is on (#41). Browsers drop
 * the lock when the page is hidden, so it asks again when the page comes back.
 * Does nothing where the Wake Lock API isn't available (it needs HTTPS).
 */
export function useKeepScreenAwake() {
  const settings = useSettingsStore();
  const { isSupported, isActive, request, release } = useWakeLock();
  const visibility = useDocumentVisibility();

  watch(
    [() => settings.wakeLockEnabled, visibility, isActive],
    async ([enabled, visible, active]) => {
      if (!isSupported.value) return;
      try {
        if (!enabled) {
          if (active) await release();
        } else if (visible === 'visible' && !active) {
          await request('screen');
        }
      } catch {
        // Refused (low battery, say): leave the screen to sleep as normal.
      }
    },
    { immediate: true },
  );

  return { isSupported };
}
