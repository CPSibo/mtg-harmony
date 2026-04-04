import type { ScryfallCard } from '~/types/Scryfall';

const SCRYFALL_ENDPOINT =
  'https://api.scryfall.com/cards/random?q=-t:land+game:paper';

export function useScryfall() {
  async function fetch(): Promise<ScryfallCardResponse | string | null> {
    try {
      let response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT);

      // Retry once if the card has no usable image (e.g. image_status 'missing').
      if (!hasUsableImage(response)) {
        response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT);

        if (!hasUsableImage(response)) {
          throw new Error('Fetched card has no image');
        }
      }

      return {
        data: response,
        date: new Date(),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error fetching card';

      return message;
    }

    return null;
  }

  return { fetch };
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
