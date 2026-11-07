import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import type { ScryfallCardSearchResponse } from '~/composables/useScryfall';
import type { ScryfallCard } from '~/types/Scryfall';

const SEARCH_ENDPOINT = 'https://api.scryfall.com/cards/search';

export type CardSearchStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * Searches Scryfall whenever `term` changes. A blank term clears the results
 * without a request (Scryfall rejects empty queries). A newer search cancels
 * the one in flight. "No matches" (a 404) is an empty result, not an error.
 * Debouncing is left to the caller.
 */
export function useCardSearch(term: MaybeRefOrGetter<string>) {
  const cards = ref<ScryfallCard[]>([]);
  const status = ref<CardSearchStatus>('idle');
  let inFlight: AbortController | undefined;

  watch(
    () => toValue(term).trim(),
    async (q) => {
      inFlight?.abort();
      inFlight = undefined;

      if (!q) {
        cards.value = [];
        status.value = 'idle';
        return;
      }

      const abort = (inFlight = new AbortController());
      status.value = 'pending';

      try {
        const url = new URL(SEARCH_ENDPOINT);
        url.searchParams.set('q', q);
        const response = await fetch(url, { signal: abort.signal });

        if (response.status === 404) {
          if (abort.signal.aborted) return;
          cards.value = [];
          status.value = 'success';
          return;
        }

        if (!response.ok)
          throw new Error(`Scryfall responded with HTTP ${response.status}`);

        const body = (await response.json()) as ScryfallCardSearchResponse;
        if (abort.signal.aborted) return;
        cards.value = body.data ?? [];
        status.value = 'success';
      } catch (ex) {
        if (abort.signal.aborted) return;
        console.error('Card search failed.', ex);
        cards.value = [];
        status.value = 'error';
      }
    },
    { immediate: true },
  );

  return { cards, status };
}
