import {
  scryfallCardFromSnapshot,
  useEventLogStore,
  type LoggedCard,
} from '~/features/eventLog';
import { useLocalStorage } from '~/composables/useLocalStorage';
import { useScryfall } from '~/composables/useScryfall';
import { useOnline } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef, triggerRef, watch } from 'vue';
import {
  cardImage,
  createBoardCard,
  readSavedCard,
} from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import type { BoardCard } from '~/types/PlayArea';

export interface DiscordFetcherStore {
  queue: BoardCard[];
  current: BoardCard | null;
  stepsBack: number;
  historyStart: number;
  cardCleared: boolean;
}

const STORAGE_KEY = 'mtg-harmony_discordFetcher';
/** Bump when the saved shape changes (#154). */
const SAVE_VERSION = 1;

/** Why Next card can't fetch while offline (#169). */
export const OFFLINE_MESSAGE =
  "You're offline. On-deck fetches new cards when you're back online.";

/** Fresh default state. A factory, so no store shares (and mutates) it. */
function createDefaults(): DiscordFetcherStore {
  return {
    queue: [],
    current: null,
    stepsBack: 0,
    historyStart: 0,
    cardCleared: false,
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

  /** The cards shown since the last reset, oldest first, from the log. */
  const shownHistory = computed(() =>
    log.entries.flatMap((e) =>
      e.type === 'fetched' && e.at >= historyStart.value ? [e.card] : [],
    ),
  );

  // A previous card is rebuilt from its log snapshot once, not on every log
  // event, so it keeps its ID while shown (#162). Snapshots are shared per
  // card and never change, so they key the cache.
  const fromSnapshot = new WeakMap<LoggedCard, BoardCard>();
  function cardFromSnapshot(snapshot: LoggedCard): BoardCard {
    let built = fromSnapshot.get(snapshot);
    if (!built) {
      built = createBoardCard(scryfallCardFromSnapshot(snapshot));
      fromSnapshot.set(snapshot, built);
    }
    return built;
  }

  const card = computed<BoardCard | null>(() => {
    if (cardCleared.value) return null;
    if (stepsBack.value === 0) return current.value;

    const snapshot =
      shownHistory.value[shownHistory.value.length - 1 - stepsBack.value];
    return snapshot ? cardFromSnapshot(snapshot) : null;
  });

  const canGoPrevious = computed(
    () => stepsBack.value + 1 < shownHistory.value.length,
  );

  type FetchResult = { success: boolean; error?: string };
  /** A fetch stopped by a reset: not an error, and nothing to show. */
  const CANCELLED: FetchResult = { success: true };

  const online = useOnline();
  /** Next card has to fetch: nothing queued, and no later card to step to. */
  const nextNeedsNetwork = computed(
    () => stepsBack.value === 0 && queue.value.length === 0,
  );
  // Back online: top up a queue that ran low while offline (#169).
  watch(online, (isOnline) => {
    if (isOnline && queue.value.length < settings.minQueuedCardCount)
      void fetchCards(settings.fetchCardCount);
  });

  // Tracks an in-flight fetchCards() call so concurrent callers (e.g. a
  // manual "next" racing next's own background top-up) await the same
  // request instead of one of them being rejected outright.
  let activeFetch: Promise<FetchResult> | null = null;

  // Bumped by reset(). A fetch started before then belongs to the old game:
  // it stops at its next card and keeps none of them (#162).
  let generation = 0;

  async function fetchCards(count: number | undefined): Promise<FetchResult> {
    if (activeFetch) return activeFetch;

    const fetch = (activeFetch = runFetch(count));

    try {
      return await fetch;
    } finally {
      // A reset may have let a newer fetch start meanwhile.
      if (activeFetch === fetch) activeFetch = null;
    }
  }

  async function runFetch(count: number | undefined): Promise<FetchResult> {
    const errors: string[] = [];
    const startedIn = generation;

    try {
      fetchingCards.value = true;

      for await (const result of scryfall.fetchMany(
        count || settings.fetchCardCount,
      )) {
        // Leaving the loop stops the generator, so no further requests.
        if (generation !== startedIn) return CANCELLED;

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
      if (generation !== startedIn) return CANCELLED;
      return {
        success: false,
        error: 'Could not fetch card',
      };
    } finally {
      if (generation === startedIn) fetchingCards.value = false;
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

    const fetchPromise = fetchCards(settings.fetchCardCount);

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

    if (!online.value && nextNeedsNetwork.value)
      return { success: false, error: OFFLINE_MESSAGE };

    const startedIn = generation;
    const result = await ensureQueuedCard();
    // New game while waiting: that card belonged to the old game.
    if (generation !== startedIn) return CANCELLED;
    if (!result.success) return result;

    const shown = queue.value.shift()!;
    triggerRef(queue);
    current.value = shown;
    cardCleared.value = false;
    log.record('fetched', { card: shown });

    if (online.value && queue.value.length < settings.minQueuedCardCount) {
      fetchCards(settings.fetchCardCount);
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
    () => queue.value[0] && cardImage(queue.value[0]),
    (url) => {
      // No images shown, so none to preload (#42).
      if (settings.preloadImagesEnabled && settings.imagesEnabled && url)
        preloadImage(url);
    },
    { immediate: true },
  );

  function clearCard() {
    cardCleared.value = true;
  }

  /**
   * Casts the card without putting it on the board (#175), for anything
   * that doesn't stay, such as an instant or sorcery: logs it as cast to the
   * graveyard and clears it.
   */
  function castToGraveyard() {
    if (!card.value) return;
    log.record('cast', { card: card.value.scryfallInfo, toGraveyard: true });
    clearCard();
  }

  /**
   * Empties the queue and the shown card, and abandons a fetch under way.
   * The log keeps what was shown.
   */
  function reset() {
    generation++;
    activeFetch = null;
    fetchingCards.value = false;
    queue.value = [];
    current.value = null;
    stepsBack.value = 0;
    cardCleared.value = false;
    historyStart.value = Date.now();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(
      STORAGE_KEY,
      {
        queue: queue.value,
        current: current.value,
        stepsBack: stepsBack.value,
        historyStart: historyStart.value,
        cardCleared: cardCleared.value,
      },
      SAVE_VERSION,
    );
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Partial<Record<keyof DiscordFetcherStore, unknown>>>(
      STORAGE_KEY,
      SAVE_VERSION,
    );

    if (!data) return false;

    // A card this version can't read is dropped, not the whole save (#154).
    const read = (value: unknown) => {
      const card = readSavedCard(value);
      if (!card)
        console.warn('Dropping a saved card this version can’t read.', value);
      return card;
    };

    if (Array.isArray(data.queue))
      queue.value = data.queue.flatMap((value) => read(value) ?? []);

    if (data.current != null) current.value = read(data.current);

    if (typeof data.stepsBack === 'number') stepsBack.value = data.stepsBack;

    if (typeof data.historyStart === 'number')
      historyStart.value = data.historyStart;

    if (typeof data.cardCleared === 'boolean')
      cardCleared.value = data.cardCleared;

    return true;
  }

  load();

  watch([queue, current, stepsBack, historyStart, cardCleared], save);

  return {
    save,
    load,
    reset,

    card,
    queue,
    canGoPrevious,
    nextNeedsNetwork,
    fetchingCards,
    fetchCards,
    next,
    prev,
    clearCard,
    castToGraveyard,
  };
});
