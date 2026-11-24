import { tryOnScopeDispose, useEventListener } from '@vueuse/core';
import { ref, watch } from 'vue';
import { useSettingsStore } from '~/stores/settings';

/**
 * Where the screen wake lock stands, for Settings to show. `waiting`: the
 * setting is on but the lock isn't held, because the page is hidden or the
 * browser refused it.
 */
export type WakeLockStatus = 'unsupported' | 'off' | 'held' | 'waiting';

// One app-wide lock, so a module-level ref; Settings only reads it.
export const wakeLockStatus = ref<WakeLockStatus>('off');

/**
 * Keeps the screen awake while "Keep screen awake" is on (#41). Does nothing
 * where the Wake Lock API isn't available (it needs HTTPS).
 *
 * Browsers drop the lock whenever they like: when the page is hidden, on
 * battery saver, or by refusing the request without a recent tap. So this
 * asks again when the page comes back or gets focus, when the lock is dropped
 * while the page is shown, and on the next tap or key press after a refusal
 * (#174). VueUse's `useWakeLock` kept a dropped lock as active after one
 * failed request, and never asked again.
 */
export function useKeepScreenAwake() {
  const settings = useSettingsStore();
  const isSupported = ref(
    typeof navigator !== 'undefined' && 'wakeLock' in navigator,
  );

  let sentinel: WakeLockSentinel | null = null;
  let requesting = false;
  let disposed = false;
  let stopRetry: (() => void) | undefined;

  const wanted = () =>
    !disposed &&
    settings.wakeLockEnabled &&
    document.visibilityState === 'visible';

  /** After a refusal, the next tap or key press gives the browser the activation it may want. */
  function retryOnNextInput() {
    if (stopRetry) return;
    // Capture, so a handler that stops propagation can't hide the tap.
    const options = { capture: true, passive: true };
    const stops = [
      useEventListener(window, 'pointerdown', retry, options),
      useEventListener(window, 'keydown', retry, options),
    ];
    stopRetry = () => stops.forEach((stop) => stop());
    function retry() {
      stopRetry?.();
      stopRetry = undefined;
      void acquire();
    }
  }

  function onRelease(lock: WakeLockSentinel) {
    if (sentinel !== lock) return;
    sentinel = null;
    // Hidden: visibilitychange asks again. Shown: the browser dropped it.
    void acquire();
  }

  async function release() {
    stopRetry?.();
    stopRetry = undefined;
    const lock = sentinel;
    sentinel = null;
    if (lock && !lock.released) await lock.release().catch(() => {});
  }

  async function acquire() {
    if (!isSupported.value) {
      wakeLockStatus.value = 'unsupported';
      return;
    }
    if (disposed || !settings.wakeLockEnabled) {
      wakeLockStatus.value = 'off';
      await release();
      return;
    }
    if (sentinel && !sentinel.released) {
      wakeLockStatus.value = 'held';
      return;
    }
    wakeLockStatus.value = 'waiting';
    if (requesting || document.visibilityState !== 'visible') return;

    requesting = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted()) {
        await lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      lock.addEventListener('release', () => onRelease(lock));
      stopRetry?.();
      stopRetry = undefined;
      wakeLockStatus.value = 'held';
    } catch {
      // Refused (no recent tap, low battery, …): try again on the next one.
      retryOnNextInput();
    } finally {
      requesting = false;
    }
  }

  watch(
    () => settings.wakeLockEnabled,
    () => void acquire(),
    {
      immediate: true,
    },
  );
  if (isSupported.value) {
    useEventListener(document, 'visibilitychange', () => void acquire());
    useEventListener(window, 'focus', () => void acquire());
    useEventListener(window, 'pageshow', () => void acquire());
  }

  tryOnScopeDispose(() => {
    disposed = true;
    void release();
  });

  return { isSupported };
}
