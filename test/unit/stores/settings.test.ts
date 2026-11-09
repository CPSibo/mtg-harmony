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

  // #104
  it('saves the pointer easing and ignores invalid values', async () => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(store.pointerSmoothing).toBe(0);

    store.setPointerSmoothing(20);
    expect((await reload()).pointerSmoothing).toBe(20);

    for (const bad of ['ease', -5, 500]) {
      localStorage.setItem(
        'mtg-harmony_settings',
        JSON.stringify([{ pointerSmoothing: 1 }, bad]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().pointerSmoothing, String(bad)).toBe(0);
    }
  });
  // #108
  it('saves the drag menu delay and ignores invalid values', async () => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(store.dragMenuDelay).toBe(1000);

    store.setDragMenuDelay(1500);
    expect((await reload()).dragMenuDelay).toBe(1500);

    for (const bad of ['slow', 0, 100, 60000]) {
      localStorage.setItem(
        'mtg-harmony_settings',
        JSON.stringify([{ dragMenuDelay: 1 }, bad]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().dragMenuDelay, String(bad)).toBe(500);
    }
  });
});
