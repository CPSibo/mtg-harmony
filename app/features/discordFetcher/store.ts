import {
  scryfallCardFromSnapshot,
  useEventLogStore,
} from '~/features/eventLog';
import { useLocalStorage } from '~/composables/useLocalStorage';
import { useScryfall } from '~/composables/useScryfall';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef, triggerRef, watch } from 'vue';
import { cardData, createBoardCard } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import type { BoardCard } from '~/types/PlayArea';

export interface DiscordFetcherStore {
  queue: BoardCard[];
  current: BoardCard | null;
  stepsBack: number;
  historyStart: number;
  cardCleared: boolean;
  fetchCardCount: number;
  minQueuedCardCount: number;
  preloadImagesEnabled: boolean;
}

const STORAGE_KEY = 'mtg-harmony_discordFetcher';

/** Fresh default state. A factory, so no store shares (and mutates) it. */
function createDefaults(): DiscordFetcherStore {
  return {
    queue: [],
    current: null,
    stepsBack: 0,
    historyStart: 0,
    cardCleared: false,
    fetchCardCount: 10,
    minQueuedCardCount: 3,
    preloadImagesEnabled: true,
  };
}

/**
 * On-deck's cards. Keeps only a queue of cards fetched ahead and the newest
 * card shown. What was shown before lives in the event log (`fetched`
 * entries), and "previous" steps back through those.
 */
export const useDiscordFetcherStore = defineStore('discordFetcher', () => {
  const defaults = createDefaults();

  const scryfall = useScryfall();
  const log = useEventLogStore();
  const settings = useSettingsStore();

  const fetchingCards = ref(false);

  // Cards here are replaced, never changed in place, so the refs are shallow
  // (#105): `queue` is triggered after a push or shift.
  /** Cards fetched ahead and not shown yet, next first. */
  const queue = shallowRef<BoardCard[]>(defaults.queue);

  /** The newest card On-deck has shown. */
  const current = shallowRef<BoardCard | null>(defaults.current);

  /** How many cards back from `current` "previous" has gone. 0 is current. */
  const stepsBack = ref(defaults.stepsBack);

  /** "Previous" doesn't go back past this time (the last reset). */
  const historyStart = ref(defaults.historyStart);

  // Hides the card without losing our place, so clearCard() -> next() reveals
  // the next *unseen* card rather than replaying one already seen.
  const cardCleared = ref(defaults.cardCleared);

  const fetchCardCount = ref(defaults.fetchCardCount);

  const minQueuedCardCount = ref(defaults.minQueuedCardCount);

  const preloadImagesEnabled = ref(defaults.preloadImagesEnabled);

  /** The cards shown since the last reset, oldest first, from the log. */
  const shownHistory = computed(() =>
    log.entries.flatMap((e) =>
      e.type === 'fetched' && e.at >= historyStart.value ? [e.card] : [],
    ),
  );

  const card = computed<BoardCard | null>(() => {
    if (cardCleared.value) return null;
    if (stepsBack.value === 0) return current.value;

    const snapshot =
      shownHistory.value[shownHistory.value.length - 1 - stepsBack.value];
    return snapshot
      ? createBoardCard(scryfallCardFromSnapshot(snapshot))
      : null;
  });

  const canGoPrevious = computed(
    () => stepsBack.value + 1 < shownHistory.value.length,
  );

  type FetchResult = { success: boolean; error?: string };

  // Tracks an in-flight fetchCards() call so concurrent callers (e.g. a
  // manual "next" racing next's own background top-up) await the same
  // request instead of one of them being rejected outright.
  let activeFetch: Promise<FetchResult> | null = null;

  async function fetchCards(count: number | undefined): Promise<FetchResult> {
    if (activeFetch) return activeFetch;

    activeFetch = runFetch(count);

    try {
      return await activeFetch;
    } finally {
      activeFetch = null;
    }
  }

  async function runFetch(count: number | undefined): Promise<FetchResult> {
    const errors: string[] = [];

    try {
      fetchingCards.value = true;

      for await (const result of scryfall.fetchMany(
        count || fetchCardCount.value,
      )) {
        if (typeof result === 'string') {
          errors.push(result);
          continue;
        }

        queue.value.push(createBoardCard(result.data));
        triggerRef(queue);
      }

      if (queue.value.length === 0) {
        return {
          success: false,
          error: errors.length
            ? `Could not fetch any cards: ${errors.join('; ')}`
            : 'Could not fetch any cards',
        };
      }

      return {
        success: true,
        error: errors.length ? errors.join('; ') : undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Could not fetch card',
      };
    } finally {
      fetchingCards.value = false;
    }
  }

  /**
   * Ensures the queue has a card. If it's empty, starts a fetch and resolves
   * as soon as the first card arrives, rather than waiting for the whole
   * batch - the fetch keeps running in the background to fill the queue.
   * Only resolves with a failure if the fetch ends without a usable card.
   */
  async function ensureQueuedCard(): Promise<FetchResult> {
    if (queue.value.length) return { success: true };

    const fetchPromise = fetchCards(fetchCardCount.value);

    return new Promise<FetchResult>((resolve) => {
      const stop = watch(
        () => queue.value.length,
        (len) => {
          if (len) {
            stop();
            resolve({ success: true });
          }
        },
      );

      fetchPromise.then((result) => {
        stop();
        if (!queue.value.length) resolve(result);
      });
    });
  }

  /**
   * Shows the next card. After "previous", steps forward through cards
   * already shown first. Otherwise takes the next queued card (awaiting a
   * fetch if the queue is empty) and logs it. If that leaves fewer than
   * `minQueuedCardCount` queued, tops up in the background (fire-and-forget;
   * `fetchCards` handles its own errors and re-entrancy).
   */
  async function next(): Promise<FetchResult> {
    if (stepsBack.value > 0) {
      stepsBack.value--;
      cardCleared.value = false;
      return { success: true };
    }

    const result = await ensureQueuedCard();
    if (!result.success) return result;

    const shown = queue.value.shift()!;
    triggerRef(queue);
    current.value = shown;
    cardCleared.value = false;
    log.record('fetched', { card: shown });

    if (queue.value.length < minQueuedCardCount.value) {
      fetchCards(fetchCardCount.value);
    }

    return { success: true };
  }

  /**
   * Steps back to the card shown before. No-ops at the first card since the
   * last reset - callers should disable the "previous" control then (see
   * `canGoPrevious`).
   */
  function prev() {
    if (!canGoPrevious.value) return;
    // From a cleared card, "previous" means the one before it.
    stepsBack.value++;
    cardCleared.value = false;
  }

  const preloadedImageUrls = new Set<string>();

  function preloadImage(url: string) {
    if (!url || preloadedImageUrls.has(url)) return;
    preloadedImageUrls.add(url);
    const img = new Image();
    img.src = url;
  }

  watch(
    () => queue.value[0]?.image_uri,
    (url) => {
      // No images shown, so none to preload (#42).
      if (preloadImagesEnabled.value && settings.imagesEnabled && url)
        preloadImage(url);
    },
    { immediate: true },
  );

  function clearCard() {
    cardCleared.value = true;
  }

  /** Empties the queue and the shown card. The log keeps what was shown. */
  function reset() {
    queue.value = [];
    current.value = null;
    stepsBack.value = 0;
    cardCleared.value = false;
    historyStart.value = Date.now();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      queue: queue.value,
      current: current.value,
      stepsBack: stepsBack.value,
      historyStart: historyStart.value,
      cardCleared: cardCleared.value,
      fetchCardCount: fetchCardCount.value,
      minQueuedCardCount: minQueuedCardCount.value,
      preloadImagesEnabled: preloadImagesEnabled.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Partial<DiscordFetcherStore>>(STORAGE_KEY);

    if (!data) return false;

    if (Array.isArray(data.queue)) {
      for (const card of data.queue)
        card.scryfallInfo = cardData(card.scryfallInfo);
      queue.value = data.queue;
    }

    if (data.current && typeof data.current === 'object') {
      data.current.scryfallInfo = cardData(data.current.scryfallInfo);
      current.value = data.current;
    }

    if (typeof data.stepsBack === 'number') stepsBack.value = data.stepsBack;

    if (typeof data.historyStart === 'number')
      historyStart.value = data.historyStart;

    if (typeof data.cardCleared === 'boolean')
      cardCleared.value = data.cardCleared;

    if (typeof data.fetchCardCount === 'number')
      fetchCardCount.value = data.fetchCardCount;

    if (typeof data.minQueuedCardCount === 'number')
      minQueuedCardCount.value = data.minQueuedCardCount;

    if (typeof data.preloadImagesEnabled === 'boolean')
      preloadImagesEnabled.value = data.preloadImagesEnabled;

    return true;
  }

  load();

  watch(
    [
      queue,
      current,
      stepsBack,
      historyStart,
      cardCleared,
      fetchCardCount,
      minQueuedCardCount,
      preloadImagesEnabled,
    ],
    save,
  );

  return {
    save,
    load,
    reset,

    card,
    queue,
    canGoPrevious,
    fetchingCards,
    fetchCardCount,
    minQueuedCardCount,
    preloadImagesEnabled,
    fetchCards,
    next,
    prev,
    clearCard,
  };
});
