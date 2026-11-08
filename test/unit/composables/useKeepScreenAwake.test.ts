import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useKeepScreenAwake } from '~/composables/useKeepScreenAwake';
import { useSettingsStore } from '~/stores/settings';

/** A stand-in for the browser's wake lock, which happy-dom lacks. */
function stubWakeLock() {
  const sentinels: { released: boolean; release: () => Promise<void> }[] = [];
  const request = vi.fn(async () => {
    const listeners: (() => void)[] = [];
    const sentinel = {
      released: false,
      type: 'screen',
      release: vi.fn(async () => {
        sentinel.released = true;
        listeners.forEach((l) => l());
      }),
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: () => {},
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  });
  return { request, sentinels };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the composable's watchers and promises run. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await nextTick();
    await Promise.resolve();
  }
}

describe('useKeepScreenAwake', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    scope = effectScope();
    setVisibility('visible');
  });

  afterEach(() => {
    scope.stop();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('keeps the screen awake while the setting is on', async () => {
    const { request } = stubWakeLock();

    scope.run(() => useKeepScreenAwake());
    await settle();

    expect(request).toHaveBeenCalledWith('screen');
  });

  it('lets the screen sleep when the setting is turned off', async () => {
    const { sentinels } = stubWakeLock();
    scope.run(() => useKeepScreenAwake());
    await settle();

    useSettingsStore().setWakeLockEnabled(false);
    await settle();

    expect(sentinels.at(-1)!.released).toBe(true);
  });

  it('does not ask for a lock when the setting is off', async () => {
    const { request } = stubWakeLock();
    useSettingsStore().setWakeLockEnabled(false);

    scope.run(() => useKeepScreenAwake());
    await settle();

    expect(request).not.toHaveBeenCalled();
  });

  it('asks again when the page comes back, as the browser drops the lock on hide', async () => {
    const { request, sentinels } = stubWakeLock();
    scope.run(() => useKeepScreenAwake());
    await settle();

    setVisibility('hidden');
    await sentinels.at(-1)!.release(); // What the browser does.
    setVisibility('visible');
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reports no support and does nothing without the API', async () => {
    const awake = scope.run(() => useKeepScreenAwake())!;
    await settle();

    expect(awake.isSupported.value).toBe(false);
  });
});
