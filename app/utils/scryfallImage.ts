import type { ScryfallCard } from '~/types/card'

/**
 * Returns the best available image URI for a card, preferring border_crop, then normal, then small.
 * Returns null when no usable image exists.
 */
export function pickImageUri(card: ScryfallCard): string | null {
  return card.image_uris?.border_crop
    ?? card.image_uris?.normal
    ?? card.image_uris?.small
    ?? null
}

/** Returns true when the card has at least one usable image URI. */
export function hasUsableImage(card: ScryfallCard): boolean {
  return pickImageUri(card) !== null
}
