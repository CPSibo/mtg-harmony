import {
  computed,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { cardData } from '~/features/battlefield';
import type { ScryfallCard } from '~/types/Scryfall';

const SEARCH_ENDPOINT = 'https://api.scryfall.com/cards/search';

/** Printings shown per grid page, so a page loads a handful of images. */
export const PRINTINGS_PAGE_SIZE = 24;

export type PrintingsStatus = 'pending' | 'success' | 'error';

/** One printing in the grid: the card, trimmed, plus where it was printed. */
export interface Printing {
  card: ScryfallCard;
  set: string;
  collectorNumber: string;
}

/** The fields of a search result this file reads beyond `ScryfallCard`. */
type PrintingResponse = ScryfallCard & {
  set?: string;
  collector_number?: string;
};

interface SearchPage {
  data?: PrintingResponse[];
  total_cards?: number;
  has_more?: boolean;
  next_page?: string;
}

/**
 * A Scryfall query for every printing of a card, in `set`. By oracle ID when
 * known: an exact name also matches other cards with a face of that name
 * (Lightning Bolt and Emeritus of Conflict // Lightning Bolt).
 */
function query(card: CardIdentity, set: string): string {
  const which = card.oracleId
    ? `oracleid:${card.oracleId}`
    : `!"${card.name.replaceAll('"', '\\"')}"`;
  return set ? `${which} e:${set}` : which;
}

/** What identifies a card across its printings. */
export interface CardIdentity {
  name: string;
  oracleId?: string;
}

/**
 * Every printing of a card from Scryfall, newest first, one grid page at a
 * time (#114). `unique=prints` gives one entry per printing, foil and
 * non-foil together. `set` filters on Scryfall by set code. Scryfall sends up
 * to 175 cards per request; the next request is made only when the grid pages
 * past what's loaded. "No matches" (404) and an unknown set (400) are empty.
 */
export function usePrintings(
  card: MaybeRefOrGetter<CardIdentity>,
  set: MaybeRefOrGetter<string>,
) {
  // Shallow: replaced or appended whole, never changed in place.
  const loaded = shallowRef<readonly Printing[]>([]);
  const total = ref(0);
  const status = ref<PrintingsStatus>('pending');
  const page = ref(1);
  let nextPage: string | undefined;
  let inFlight: AbortController | undefined;

  const pageCount = computed(() =>
    Math.ceil(total.value / PRINTINGS_PAGE_SIZE),
  );
  const visible = computed(() => {
    const start = (page.value - 1) * PRINTINGS_PAGE_SIZE;
    return loaded.value.slice(start, start + PRINTINGS_PAGE_SIZE);
  });

  async function request(url: URL | string, abort: AbortController) {
    status.value = 'pending';
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (response.status === 404 || response.status === 400) {
        if (abort.signal.aborted) return;
        nextPage = undefined;
        status.value = 'success';
        return;
      }
      if (!response.ok)
        throw new Error(`Scryfall responded with HTTP ${response.status}`);

      const body = (await response.json()) as SearchPage;
      if (abort.signal.aborted) return;
      loaded.value = [
        ...loaded.value,
        ...(body.data ?? []).map((card) => ({
          card: cardData(card),
          set: card.set ?? '',
          collectorNumber: card.collector_number ?? '',
        })),
      ];
      total.value = body.total_cards ?? loaded.value.length;
      nextPage = body.has_more ? body.next_page : undefined;
      status.value = 'success';
    } catch (ex) {
      if (abort.signal.aborted) return;
      console.error('Printings search failed.', ex);
      status.value = 'error';
    }
  }

  watch(
    () =>
      [
        toValue(card).name.trim(),
        toValue(card).oracleId,
        toValue(set)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''),
      ] as const,
    ([n, oracleId, s]) => {
      inFlight?.abort();
      loaded.value = [];
      total.value = 0;
      nextPage = undefined;
      page.value = 1;
      if (!n) return;

      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set('q', query({ name: n, oracleId }, s));
      url.searchParams.set('unique', 'prints');
      url.searchParams.set('order', 'released');
      url.searchParams.set('dir', 'desc');
      void request(url, (inFlight = new AbortController()));
    },
    { immediate: true },
  );

  // Fetch Scryfall's next page once the grid pages past what's loaded.
  watch(page, (p) => {
    if (
      nextPage &&
      status.value !== 'pending' &&
      p * PRINTINGS_PAGE_SIZE > loaded.value.length
    ) {
      void request(nextPage, (inFlight = new AbortController()));
    }
  });

  return { visible, page, pageCount, status, total };
}
