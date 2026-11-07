import { stringify } from 'devalue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { ScryfallCardResponse } from '~/composables/useScryfall';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { makeCard, makeScryfallCard } from '../fixtures/cards';

const STORAGE_KEY = 'mtg-harmony_discordFetcher';

type FetchManyResult = ScryfallCardResponse | string;

/**
 * What the mocked Scryfall yields. By default every call yields `n` new
 * cards; a test can replace this to return errors or throw.
 */
let produce: (n: number) => FetchManyResult[];

const fetchMany = vi.fn(async function* (
  n: number,
): AsyncGenerator<FetchManyResult, void, unknown> {
  for (const result of produce(n)) {
    await Promise.resolve(); // Arrive one at a time, like real requests.
    yield result;
  }
});

vi.mock('~/composables/useScryfall', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/composables/useScryfall')>()),
  useScryfall: () => ({ fetch: vi.fn(), fetchMany }),
}));

function cards(n: number): FetchManyResult[] {
  return Array.from({ length: n }, () => ({
    data: makeScryfallCard(),
    date: new Date(),
  }));
}

/** Waits for any background fetch the store started to finish. */
async function settle(store: ReturnType<typeof useDiscordFetcherStore>) {
  await vi.waitFor(() => expect(store.fetchingCards).toBe(false));
}

describe('discord fetcher store', () => {
  beforeEach(() => {
    produce = cards;
    fetchMany.mockClear();
    // Stop the image preloader from touching the network.
    vi.stubGlobal(
      'Image',
      class {
        src = '';
      },
    );
  });

  describe('next', () => {
    it('fetches a batch and shows its first card', async () => {
      const store = useDiscordFetcherStore();

      const result = await store.next();
      await settle(store);

      expect(result).toEqual({ success: true });
      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(10);
      expect(store.cards).toHaveLength(10);
      expect(store.activeIndex).toBe(0);
      expect(store.card?.id).toBe(store.cards[0]!.id);
    });

    it('maps Scryfall cards to untapped board cards', async () => {
      const scryfallCard = makeScryfallCard({ name: 'Pacifism' });
      produce = () => [{ data: scryfallCard, date: new Date() }];
      const store = useDiscordFetcherStore();

      await store.next();

      expect(store.card).toMatchObject({
        scryfallInfo: scryfallCard,
        name: 'Pacifism',
        image_uri: scryfallCard.image_uris!.border_crop,
        tapped: false,
        faceNumber: 0,
      });
      expect(store.card?.modifiers.size).toBe(0);
      // #23: history cards get instance IDs, not the Scryfall ID.
      expect(store.card?.id).not.toBe(scryfallCard.id);
    });

    it('moves through cards already fetched without fetching again', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);

      await store.next();
      await store.next();

      expect(store.activeIndex).toBe(2);
      expect(fetchMany).toHaveBeenCalledOnce();
    });

    it('tops up in the background when fewer than 3 cards are left ahead', async () => {
      const store = useDiscordFetcherStore();
      await store.next(); // Index 0 of 10: 9 ahead.
      await settle(store);

      for (let i = 0; i < 6; i++) await store.next(); // Index 6: 3 ahead.
      expect(fetchMany).toHaveBeenCalledOnce();

      await store.next(); // Index 7: 2 ahead.
      await settle(store);

      expect(fetchMany).toHaveBeenCalledTimes(2);
      expect(store.cards).toHaveLength(20);
      expect(store.activeIndex).toBe(7);
    });

    it('reports an error and stays put when no card arrives', async () => {
      produce = () => ['Scryfall is down', 'Scryfall is down'];
      const store = useDiscordFetcherStore();

      const result = await store.next();

      expect(result).toEqual({
        success: false,
        error: 'Could not fetch any cards: Scryfall is down; Scryfall is down',
      });
      expect(store.activeIndex).toBe(-1);
      expect(store.card).toBeNull();
    });

    it('reports a generic error when the fetch throws', async () => {
      produce = () => {
        throw new Error('network');
      };
      const store = useDiscordFetcherStore();

      const result = await store.next();

      expect(result).toEqual({ success: false, error: 'Could not fetch card' });
      expect(store.fetchingCards).toBe(false);
    });
  });

  describe('fetchCards', () => {
    it('keeps the cards that arrived and reports the errors', async () => {
      produce = () => [...cards(1), 'Card had no image', ...cards(1)];
      const store = useDiscordFetcherStore();

      const result = await store.fetchCards(3);

      expect(result).toEqual({ success: true, error: 'Card had no image' });
      expect(store.cards).toHaveLength(2);
    });

    it('shares one request between overlapping calls', async () => {
      const store = useDiscordFetcherStore();

      const [a, b] = await Promise.all([
        store.fetchCards(2),
        store.fetchCards(5),
      ]);

      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(2);
      expect(a).toEqual(b);
      expect(store.cards).toHaveLength(2);
    });

    it('uses the batch size when no count is given', async () => {
      const store = useDiscordFetcherStore();

      await store.fetchCards(undefined);

      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(10);
    });
  });

  describe('prev and clear', () => {
    it('steps back through history, stopping at the first card', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);
      expect(store.canGoPrevious).toBe(true);

      store.prev();
      expect(store.activeIndex).toBe(0);
      expect(store.canGoPrevious).toBe(false);

      store.prev();
      expect(store.activeIndex).toBe(0);
    });

    it('hides the card on clear, and next shows the following unseen card', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);

      store.clearCard();
      expect(store.card).toBeNull();
      expect(store.activeIndex).toBe(0);

      await store.next();
      expect(store.card?.id).toBe(store.cards[1]!.id);
    });

    it('prev after clear shows the previous card again', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);
      store.clearCard();

      store.prev();

      expect(store.card?.id).toBe(store.cards[0]!.id);
    });
  });

  it('preloads the image of the card after the current one', async () => {
    const created: { src: string }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        constructor() {
          created.push(this);
        }
      },
    );
    const store = useDiscordFetcherStore();

    await store.next();
    await settle(store);

    expect(created.map((img) => img.src)).toContain(store.cards[1]!.image_uri);
  });

  it('reset empties the history', async () => {
    const store = useDiscordFetcherStore();
    await store.next();
    await settle(store);
    store.clearCard();

    store.reset();

    expect(store.cards).toEqual([]);
    expect(store.activeIndex).toBe(-1);
    expect(store.card).toBeNull();
  });

  describe('persistence', () => {
    // #24: only the history, position and cleared flag were watched, so a
    // settings change on its own was never saved.
    it.each([
      ['fetchCardCount', 4],
      ['minQueuedCardCount', 1],
      ['preloadImagesEnabled', false],
    ] as const)('saves a change to %s on its own', async (name, value) => {
      vi.useFakeTimers();
      const store = useDiscordFetcherStore();
      expect(store[name]).not.toBe(value);

      (store[name] as typeof value) = value;
      await nextTick();
      vi.runAllTimers();
      setActivePinia(createPinia());

      expect(useDiscordFetcherStore()[name]).toBe(value);
    });

    it('loads saved history and settings', () => {
      const saved = [makeCard({ name: 'A' }), makeCard({ name: 'B' })];
      localStorage.setItem(
        STORAGE_KEY,
        stringify({
          cards: saved,
          activeIndex: 1,
          cardCleared: false,
          fetchCardCount: 5,
          minQueuedCardCount: 2,
          preloadImagesEnabled: false,
        }),
      );

      const store = useDiscordFetcherStore();

      expect(store.card?.name).toBe('B');
      expect(store.fetchCardCount).toBe(5);
      expect(store.minQueuedCardCount).toBe(2);
      expect(store.preloadImagesEnabled).toBe(false);
    });
  });
});
