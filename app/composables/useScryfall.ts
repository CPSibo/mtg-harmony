import type { ScryfallCard } from '~/types/Scryfall';

const SCRYFALL_ENDPOINT =
  'https://api.scryfall.com/cards/random?q=-t:land+game:paper';

// Scryfall's docs specify a 2 req/s hard cap. 600ms keeps us under that
// with some margin instead of shaving it exactly to 500ms.
const MIN_REQUEST_INTERVAL_MS = 600;

// Per Scryfall's docs: the first 429 buys you a 30s window where nothing
// will be answered. Wait it out once; a second 429 after that means
// something's wrong and we should bail rather than risk a temp ban.
const RATE_LIMIT_COOLDOWN_MS = 30_000;

// Shared across calls (and concurrent generator instances) so bursts
// from multiple callers can't stack up and blow the rate limit.
let lastRequestTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function isRateLimitError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { status?: unknown; statusCode?: unknown });
  return status.status === 429 || status.statusCode === 429;
}

export function useScryfall() {
  async function fetchOne(): Promise<ScryfallCardResponse> {
    await throttle();
    let response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT);

    // Retry once if the card has no usable image (e.g. image_status 'missing').
    if (!hasUsableImage(response)) {
      await throttle();
      response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT);

      if (!hasUsableImage(response)) {
        throw new Error('Fetched card has no image');
      }
    }

    return {
      data: response,
      date: new Date(),
    };
  }

  async function fetch(): Promise<ScryfallCardResponse | string | null> {
    try {
      return await fetchOne();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error fetching card';

      return message;
    }
  }

  /**
   * Fetches `n` cards, yielding each as soon as it's ready. Individual
   * errors are yielded as strings (matching `fetch`'s error shape) rather
   * than throwing, so one bad card doesn't kill the stream. A 429 is
   * treated specially: wait out Scryfall's 30s cooldown once, and if it
   * happens again immediately after, stop entirely rather than keep
   * hammering an endpoint that's already flagged us.
   */
  async function* fetchMany(
    n: number,
  ): AsyncGenerator<ScryfallCardResponse | string, void, unknown> {
    let fetched = 0;
    let rateLimitedOnce = false;

    while (fetched < n) {
      try {
        const result = await fetchOne();
        yield result;
        fetched++;
        rateLimitedOnce = false; // reset once we successfully get through
      } catch (err) {
        if (isRateLimitError(err)) {
          if (rateLimitedOnce) {
            yield 'Rate limited again after cooldown; stopping to avoid a temporary ban.';
            return;
          }

          rateLimitedOnce = true;
          yield `Rate limited by Scryfall; pausing ${RATE_LIMIT_COOLDOWN_MS / 1000}s before retrying...`;
          await sleep(RATE_LIMIT_COOLDOWN_MS);
          continue; // retry this slot, don't count it against n
        }

        const message =
          err instanceof Error ? err.message : 'Unknown error fetching card';
        yield message;
        fetched++;
      }
    }
  }

  return { fetch, fetchMany };
}

/**
 * Returns the best available image URI for a card, preferring border_crop, then normal, then small.
 * Returns null when no usable image exists.
 */
export function pickImageUri(card: ScryfallCard): string | null {
  return (
    card.image_uris?.border_crop ??
    card.image_uris?.normal ??
    card.image_uris?.small ??
    null
  );
}

/** Returns true when the card has at least one usable image URI. */
function hasUsableImage(card: ScryfallCard): boolean {
  return pickImageUri(card) !== null;
}

export interface ScryfallCardResponse {
  data: ScryfallCard;
  date: Date;
}

export interface ScryfallCardSearchResponse {
  data: ScryfallCard[];
}