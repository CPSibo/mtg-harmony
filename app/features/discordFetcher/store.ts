import type { BoardCard, BoardCardModifier } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';

export interface DiscordFetcherStore {
  cards: BoardCard[];
  activeIndex: number;
  cardCleared: boolean;
  fetchCardCount: number;
  minQueuedCardCount: number;
  preloadImagesEnabled: boolean;
}

const STORAGE_KEY = 'mtg-harmony_discordFetcher';

const defaults: DiscordFetcherStore = {
  cards: [],
  activeIndex: -1,
  cardCleared: false,
  fetchCardCount: 10,
  minQueuedCardCount: 3,
  preloadImagesEnabled: true,
};

export const useDiscordFetcherStore = defineStore('discordFetcher', () => {
  const scryfall = useScryfall();

  const fetchingCards = ref(false);

  // Full history of every card ever fetched, in fetch order. Cards are only
  // ever appended, never removed - "next"/"prev" just move activeIndex
  // around within it.
  const cards = ref<BoardCard[]>(defaults.cards);

  // Index of the currently displayed card within `cards`. -1 means nothing
  // has ever been shown yet.
  const activeIndex = ref(defaults.activeIndex);

  // Masks the active card without losing our place in the history, so that
  // clearCard() -> next() reveals the next *unseen* card rather than
  // replaying something already seen. See `card` computed below.
  const cardCleared = ref(defaults.cardCleared);

  const fetchCardCount = ref(defaults.fetchCardCount);

  const minQueuedCardCount = ref(defaults.minQueuedCardCount);

  const preloadImagesEnabled = ref(defaults.preloadImagesEnabled);

  const card = computed<BoardCard | null>(() => {
    if (cardCleared.value) return null;
    return cards.value[activeIndex.value] ?? null;
  });

  const canGoPrevious = computed(() => activeIndex.value > 0);

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

        cards.value.push(mapScryfallCardToBoardCard(result.data));
      }

      if (cards.value.length === 0) {
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

  function mapScryfallCardToBoardCard(scryfallCard: ScryfallCard): BoardCard {
    return {
      id: scryfallCard.id,
      scryfallInfo: scryfallCard,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      image_uri: pickImageUri(scryfallCard) ?? '',
      scryfall_uri: scryfallCard.scryfall_uri,
      modifiers: new Set<BoardCardModifier>(),
      tapped: false,
      faceNumber: 0,
    };
  }

  /**
   * Ensures there's a card available immediately after the active index. If
   * one is already in the history, resolves immediately. Otherwise starts a
   * fetch and resolves as soon as a card past activeIndex arrives, rather
   * than waiting for the whole batch - the fetch keeps running in the
   * background to fill the rest of the lookahead. Only resolves with a
   * failure if the fetch ends without ever producing a usable card.
   */
  async function ensureNextCardAvailable(): Promise<FetchResult> {
    if (activeIndex.value + 1 < cards.value.length) {
      return { success: true };
    }

    const fetchPromise = fetchCards(fetchCardCount.value);

    return new Promise<FetchResult>((resolve) => {
      const stop = watch(
        () => cards.value.length,
        (len) => {
          if (activeIndex.value + 1 < len) {
            stop();
            resolve({ success: true });
          }
        },
      );

      fetchPromise.then((result) => {
        stop();
        // If we get here and there's still nothing past activeIndex, the
        // fetch produced nothing usable - surface its error. Otherwise the
        // watcher above already resolved this promise and this is a no-op.
        if (activeIndex.value + 1 >= cards.value.length) {
          resolve(result);
        }
      });
    });
  }

  /**
   * Advances to the next card. If one is already in the history (either
   * pre-fetched lookahead, or a card we've been to before via prev()), moves
   * to it immediately. Otherwise awaits a fetch for just the first new card,
   * same as before. If that drops the remaining lookahead below
   * `minQueuedCardCount`, kicks off a background top-up fetch
   * (fire-and-forget; `fetchCards` handles its own errors and re-entrancy,
   * so nothing here needs to await or catch it).
   */
  async function next(): Promise<FetchResult> {
    const hasNextCard = activeIndex.value + 1 < cards.value.length;

    if (!hasNextCard) {
      const result = await ensureNextCardAvailable();
      if (!result.success) return result;
    }

    cardCleared.value = false;
    activeIndex.value++;

    const remainingAhead = cards.value.length - 1 - activeIndex.value;
    if (remainingAhead < minQueuedCardCount.value) {
      fetchCards(fetchCardCount.value);
    }

    return { success: true };
  }

  /**
   * Steps back to the previously shown card. No-ops once activeIndex is
   * already 0 - callers should disable the "previous" control in that case
   * (see `canGoPrevious`).
   */
  function prev() {
    if (activeIndex.value <= 0) return;
    cardCleared.value = false;
    activeIndex.value--;
  }

  const preloadedImageUrls = new Set<string>();

  function preloadImage(url: string) {
    if (!url || preloadedImageUrls.has(url)) return;
    preloadedImageUrls.add(url);
    const img = new Image();
    img.src = url;
  }

  watch(
    [cards, activeIndex],
    ([list, idx]) => {
      if (!preloadImagesEnabled.value) return;

      const next = list[idx + 1];
      if (next?.image_uri) preloadImage(next.image_uri);
    },
    { deep: true, immediate: true },
  );

  function clearCard() {
    cardCleared.value = true;
  }

  function reset() {
    cardCleared.value = false;
    cards.value = [];
    activeIndex.value = -1;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      cards: cards.value,
      activeIndex: activeIndex.value,
      cardCleared: cardCleared.value,
      fetchCardCount: fetchCardCount.value,
      minQueuedCardCount: minQueuedCardCount.value,
      preloadImagesEnabled: preloadImagesEnabled.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<DiscordFetcherStore>(STORAGE_KEY);

    if (!data) return false;

    if (Array.isArray(data?.cards)) cards.value = data.cards;

    if (typeof data?.activeIndex === 'number') {
      // Clamp in case storage is stale relative to the loaded history.
      activeIndex.value = Math.min(data.activeIndex, cards.value.length - 1);
    }

    if (typeof data?.cardCleared === 'boolean')
      cardCleared.value = data.cardCleared;

    if (typeof data?.fetchCardCount === 'number')
      fetchCardCount.value = data.fetchCardCount;

    if (typeof data?.minQueuedCardCount === 'number')
      minQueuedCardCount.value = data.minQueuedCardCount;

    if (typeof data?.preloadImagesEnabled === 'boolean')
      preloadImagesEnabled.value = data.preloadImagesEnabled;

    return true;
  }

  if (import.meta.client) load();

  watch(
    [cards, activeIndex, cardCleared],
    () => {
      save();
    },
    { deep: true },
  );

  return {
    save,
    load,
    reset,

    card,
    cards,
    activeIndex,
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
