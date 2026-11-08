import { stringify } from 'devalue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, isReactive } from 'vue';
import { flushSaves } from '~/composables/useLocalStorage';
import type { ScryfallCardResponse } from '~/composables/useScryfall';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { useEventLogStore } from '~/features/eventLog';
import { useSettingsStore } from '~/stores/settings';
import { makeScryfallCard } from '../fixtures/cards';

const STORAGE_KEY = 'mtg-harmony_discordFetcher';

type FetchManyResult = ScryfallCardResponse | string;

/**
 * What the mocked Scryfall yields. By default every call yields `n` new
 * cards named "Card 1", "Card 2", … in fetch order; a test can replace this
 * to return errors or throw.
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

let fetchedSoFar = 0;

function namedCards(n: number): FetchManyResult[] {
  return Array.from({ length: n }, () => ({
    data: makeScryfallCard({ name: `Card ${++fetchedSoFar}` }),
    date: new Date(),
  }));
}

/** Waits for any background fetch the store started to finish. */
async function settle(store: ReturnType<typeof useDiscordFetcherStore>) {
  await vi.waitFor(() => expect(store.fetchingCards).toBe(false));
}

/** Names of the cards On-deck has shown, oldest first, from the log. */
function shownNames() {
  return useEventLogStore()
    .entries.filter((e) => e.type === 'fetched')
    .map((e) => ('card' in e ? e.card.name : ''));
}

describe('discord fetcher store', () => {
  beforeEach(() => {
    fetchedSoFar = 0;
    produce = namedCards;
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
    it('fetches a batch, shows its first card and queues the rest', async () => {
      const store = useDiscordFetcherStore();

      const result = await store.next();
      await settle(store);

      expect(result).toEqual({ success: true });
      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(10);
      expect(store.card?.name).toBe('Card 1');
      expect(store.queue.map((c) => c.name)).toEqual(
        Array.from({ length: 9 }, (_, i) => `Card ${i + 2}`),
      );
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
      // #23: On-deck cards get instance IDs, not the Scryfall ID.
      expect(store.card?.id).not.toBe(scryfallCard.id);
    });

    it('takes queued cards without fetching again', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);

      await store.next();
      await store.next();

      expect(store.card?.name).toBe('Card 3');
      expect(store.queue).toHaveLength(7);
      expect(fetchMany).toHaveBeenCalledOnce();
    });

    it('tops up in the background when fewer than 3 cards are queued', async () => {
      const store = useDiscordFetcherStore();
      await store.next(); // 9 queued.
      await settle(store);

      for (let i = 0; i < 6; i++) await store.next(); // 3 queued.
      expect(fetchMany).toHaveBeenCalledOnce();

      await store.next(); // 2 queued.
      await settle(store);

      expect(fetchMany).toHaveBeenCalledTimes(2);
      expect(store.queue).toHaveLength(12);
      expect(store.card?.name).toBe('Card 8');
    });

    it('reports an error and stays put when no card arrives', async () => {
      produce = () => ['Scryfall is down', 'Scryfall is down'];
      const store = useDiscordFetcherStore();

      const result = await store.next();

      expect(result).toEqual({
        success: false,
        error: 'Could not fetch any cards: Scryfall is down; Scryfall is down',
      });
      expect(store.card).toBeNull();
      expect(shownNames()).toEqual([]);
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
      produce = () => [...namedCards(1), 'Card had no image', ...namedCards(1)];
      const store = useDiscordFetcherStore();

      const result = await store.fetchCards(3);

      expect(result).toEqual({ success: true, error: 'Card had no image' });
      expect(store.queue).toHaveLength(2);
    });

    it('shares one request between overlapping calls', async () => {
      const store = useDiscordFetcherStore();

      const [a, b] = await Promise.all([
        store.fetchCards(2),
        store.fetchCards(5),
      ]);

      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(2);
      expect(a).toEqual(b);
      expect(store.queue).toHaveLength(2);
    });

    it('uses the batch size when no count is given', async () => {
      const store = useDiscordFetcherStore();

      await store.fetchCards(undefined);

      expect(fetchMany).toHaveBeenCalledExactlyOnceWith(10);
    });
  });

  // #36, #38: what was shown lives in the event log.
  describe('event log', () => {
    it('logs a card when it is shown, not when it is queued', async () => {
      const store = useDiscordFetcherStore();

      await store.next();
      await store.next();
      await settle(store);

      expect(shownNames()).toEqual(['Card 1', 'Card 2']);
      const entry = useEventLogStore().entries[0];
      expect(entry && 'card' in entry && entry.card.instanceId).toBeTruthy();
    });

    it('does not log again when stepping back and forward', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);

      store.prev();
      await store.next();

      expect(shownNames()).toEqual(['Card 1', 'Card 2']);
    });
  });

  describe('prev and clear', () => {
    it('steps back through shown cards, stopping at the first', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await store.next();
      await settle(store);
      expect(store.canGoPrevious).toBe(true);

      store.prev();
      expect(store.card?.name).toBe('Card 2');
      store.prev();
      expect(store.card?.name).toBe('Card 1');
      expect(store.canGoPrevious).toBe(false);

      store.prev();
      expect(store.card?.name).toBe('Card 1');
    });

    it('a previous card keeps its text, for text cards', async () => {
      const text = {
        mana_cost: '{2}{G}',
        type_line: 'Creature — Ooze',
        oracle_text: 'Trample',
        power: '3',
        toughness: '3',
        card_faces: [{ name: 'Front', oracle_text: 'Front text' }],
      };
      produce = (n) =>
        namedCards(n).map((r) =>
          typeof r === 'string' ? r : { ...r, data: { ...r.data, ...text } },
        );
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);

      store.prev();

      expect(store.card?.scryfallInfo).toMatchObject(text);
    });

    it('a previous card can still be cast', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      const first = store.card!;
      await store.next();
      await settle(store);

      store.prev();

      expect(store.card?.scryfallInfo.id).toBe(first.scryfallInfo.id);
      expect(store.card?.image_uri).toBe(first.image_uri);
    });

    it('next after prev re-shows cards before taking a new one', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);
      store.prev();

      await store.next();
      expect(store.card?.name).toBe('Card 2');
      await store.next();
      expect(store.card?.name).toBe('Card 3');
      expect(store.queue).toHaveLength(7);
    });

    it('hides the card on clear, and next shows the following unseen card', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);

      store.clearCard();
      expect(store.card).toBeNull();

      await store.next();
      expect(store.card?.name).toBe('Card 2');
    });

    it('prev after clear shows the previous card again', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);
      store.clearCard();

      store.prev();

      expect(store.card?.name).toBe('Card 1');
    });
  });

  it('preloads the image of the next queued card', async () => {
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

    expect(created.map((img) => img.src)).toContain(store.queue[0]!.image_uri);
  });

  // #42
  it('preloads no images when card images are off', async () => {
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
    useSettingsStore().setImagesEnabled(false);
    const store = useDiscordFetcherStore();

    await store.next();
    await settle(store);

    expect(created.filter((img) => img.src)).toEqual([]);
  });

  it('reset empties the queue and starts previous afresh, keeping the log', async () => {
    const store = useDiscordFetcherStore();
    await store.next();
    await store.next();
    await settle(store);

    store.reset();

    expect(store.queue).toEqual([]);
    expect(store.card).toBeNull();
    expect(store.canGoPrevious).toBe(false);
    expect(shownNames()).toEqual(['Card 1', 'Card 2']);

    await store.next();
    await settle(store);
    expect(store.canGoPrevious).toBe(false);
  });

  describe('persistence', () => {
    // #24: settings changes on their own must be saved.
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

    it('keeps the shown card, the queue and the place in history over a reload', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await store.next();
      await settle(store);
      store.prev();
      await nextTick();
      flushSaves();

      setActivePinia(createPinia());
      const reloaded = useDiscordFetcherStore();

      expect(reloaded.card?.name).toBe('Card 1');
      expect(reloaded.queue).toHaveLength(8);
      await reloaded.next();
      expect(reloaded.card?.name).toBe('Card 2');
    });

    it('keeps loaded Scryfall data out of Vue reactivity', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);
      flushSaves();

      setActivePinia(createPinia());
      const reloaded = useDiscordFetcherStore();

      expect(isReactive(reloaded.card!.scryfallInfo)).toBe(false);
      expect(isReactive(reloaded.queue[0]!.scryfallInfo)).toBe(false);
    });

    // #105: cards are replaced, never changed in place, so a shallow ref will do.
    it('holds On-deck cards without deep reactivity', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);

      expect(isReactive(store.card)).toBe(false);
      expect(isReactive(store.queue[0])).toBe(false);
    });

    it('saves cards queued in the background', async () => {
      const store = useDiscordFetcherStore();
      await store.next();
      await settle(store);
      await nextTick();
      flushSaves();

      setActivePinia(createPinia());
      expect(useDiscordFetcherStore().queue).toHaveLength(9);
    });

    it('loads saved settings', () => {
      localStorage.setItem(
        STORAGE_KEY,
        stringify({
          fetchCardCount: 5,
          minQueuedCardCount: 2,
          preloadImagesEnabled: false,
        }),
      );

      const store = useDiscordFetcherStore();

      expect(store.fetchCardCount).toBe(5);
      expect(store.minQueuedCardCount).toBe(2);
      expect(store.preloadImagesEnabled).toBe(false);
    });
  });
});
