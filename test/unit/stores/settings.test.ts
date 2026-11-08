import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useSettingsStore } from '~/stores/settings';

type Store = ReturnType<typeof useSettingsStore>;

/** Lets the debounced save run, then builds the store again from storage. */
async function reload() {
  await nextTick();
  vi.runAllTimers();
  setActivePinia(createPinia());
  return useSettingsStore();
}

describe('settings store', () => {
  // #24: imagesEnabled wasn't watched, so it was never saved.
  it.each<[string, (store: Store) => void, (store: Store) => boolean]>([
    [
      'wakeLockEnabled',
      (s) => s.setWakeLockEnabled(false),
      (s) => s.wakeLockEnabled,
    ],
    ['imagesEnabled', (s) => s.setImagesEnabled(false), (s) => s.imagesEnabled],
    [
      'cardOutlineEnabled',
      (s) => s.setCardOutlineEnabled(false),
      (s) => s.cardOutlineEnabled,
    ],
  ])('saves %s', async (_name, change, read) => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(read(store)).toBe(true);

    change(store);

    expect(read(await reload())).toBe(false);
  });
});
