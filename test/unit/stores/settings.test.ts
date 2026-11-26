import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        JSON.stringify([{ version: 2, pointerSmoothing: 1 }, bad, 1]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().pointerSmoothing, String(bad)).toBe(0);
    }
  });
  // #159: moved here from the fetcher store, so Reset app restores them.
  it('saves the On-deck settings and ignores invalid values', async () => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(store.fetchCardCount).toBe(10);
    expect(store.minQueuedCardCount).toBe(3);
    expect(store.preloadImagesEnabled).toBe(true);

    store.fetchCardCount = 5;
    store.minQueuedCardCount = 2;
    store.preloadImagesEnabled = false;
    const reloaded = await reload();
    expect(reloaded.fetchCardCount).toBe(5);
    expect(reloaded.minQueuedCardCount).toBe(2);
    expect(reloaded.preloadImagesEnabled).toBe(false);

    for (const bad of ['many', 0, 2.5, 51]) {
      localStorage.setItem(
        'mtg-harmony_settings',
        JSON.stringify([{ fetchCardCount: 1, minQueuedCardCount: 1 }, bad]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().fetchCardCount, String(bad)).toBe(10);
      expect(useSettingsStore().minQueuedCardCount, String(bad)).toBe(3);
    }
  });

  it('reset restores every setting, On-deck included', () => {
    const store = useSettingsStore();
    store.setImagesEnabled(false);
    store.fetchCardCount = 20;
    store.minQueuedCardCount = 5;
    store.preloadImagesEnabled = false;

    store.reset();

    expect(store.imagesEnabled).toBe(true);
    expect(store.fetchCardCount).toBe(10);
    expect(store.minQueuedCardCount).toBe(3);
    expect(store.preloadImagesEnabled).toBe(true);
  });

  // #246
  it('saves the board background and its colours', async () => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(store.boardBackgroundEnabled).toBe(true);
    expect(store.boardColors).toEqual([]);
    expect(store.boardSpotlightsEnabled).toBe(false);

    store.setBoardBackgroundEnabled(false);
    store.setBoardColors(['G', 'W', 'G', 'C']);
    store.setBoardSpotlightsEnabled(true);
    expect(store.boardColors).toEqual(['W', 'G', 'C']);

    const reloaded = await reload();
    expect(reloaded.boardBackgroundEnabled).toBe(false);
    expect(reloaded.boardColors).toEqual(['W', 'G', 'C']);
    expect(reloaded.boardSpotlightsEnabled).toBe(true);

    reloaded.reset();
    expect(reloaded.boardBackgroundEnabled).toBe(true);
    expect(reloaded.boardColors).toEqual([]);
    expect(reloaded.boardSpotlightsEnabled).toBe(false);
  });

  it('toggles one board colour at a time', () => {
    const store = useSettingsStore();
    store.toggleBoardColor('R');
    store.toggleBoardColor('U');
    expect(store.boardColors).toEqual(['U', 'R']);
    store.toggleBoardColor('R');
    expect(store.boardColors).toEqual(['U']);
  });

  it('ignores invalid saved board colours', () => {
    for (const bad of ['WUB', 3]) {
      localStorage.setItem(
        'mtg-harmony_settings',
        JSON.stringify([
          {
            boardColors: 1,
            boardBackgroundEnabled: 1,
            boardSpotlightsEnabled: 1,
          },
          bad,
        ]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().boardColors, String(bad)).toEqual([]);
      expect(useSettingsStore().boardBackgroundEnabled, String(bad)).toBe(true);
      expect(useSettingsStore().boardSpotlightsEnabled, String(bad)).toBe(
        false,
      );
    }
  });

  // #108
  it('saves the drag menu delay and ignores invalid values', async () => {
    vi.useFakeTimers();
    const store = useSettingsStore();
    expect(store.dragMenuDelay).toBe(500);

    store.setDragMenuDelay(1500);
    expect((await reload()).dragMenuDelay).toBe(1500);

    for (const bad of ['slow', 0, 100, 60000]) {
      localStorage.setItem(
        'mtg-harmony_settings',
        JSON.stringify([{ version: 2, dragMenuDelay: 1 }, bad, 1]),
      );
      setActivePinia(createPinia());
      expect(useSettingsStore().dragMenuDelay, String(bad)).toBe(500);
    }
  });

  // #242
  describe('when the browser asks to save data', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(prefers-reduced-data: reduce)',
      }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('starts with images and preloading off', () => {
      const store = useSettingsStore();
      expect(store.imagesEnabled).toBe(false);
      expect(store.preloadImagesEnabled).toBe(false);
    });

    it('keeps a saved choice', async () => {
      vi.useFakeTimers();
      const store = useSettingsStore();
      store.setImagesEnabled(true);
      store.preloadImagesEnabled = true;

      const reloaded = await reload();
      expect(reloaded.imagesEnabled).toBe(true);
      expect(reloaded.preloadImagesEnabled).toBe(true);
    });

    it('reset goes back to the preference', () => {
      const store = useSettingsStore();
      store.setImagesEnabled(true);
      store.preloadImagesEnabled = true;

      store.reset();

      expect(store.imagesEnabled).toBe(false);
      expect(store.preloadImagesEnabled).toBe(false);
    });
  });
});
