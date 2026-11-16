import { pickImageUri } from '~/composables/useScryfall';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard, ScryfallCardFace } from '~/types/Scryfall';

/**
 * The standard Magic card back. Every single-faced card shares it, so one URL
 * means the browser fetches and caches it once.
 */
export const STANDARD_BACK_URI =
  'https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

/** The back face, when the card has its own back image (double-faced cards). */
function backFace(info: ScryfallCard): ScryfallCardFace | undefined {
  const back = info.card_faces?.[1];
  return back?.image_uris ? back : undefined;
}

/** The image the card shows: its front, its back face, or the standard back. */
export function shownImageUri(card: BoardCard): string {
  if (!card.flipped) return card.image_uri;
  const back = backFace(card.scryfallInfo);
  return (
    (back && pickImageUri({ image_uris: back.image_uris } as ScryfallCard)) ??
    STANDARD_BACK_URI
  );
}

const LANDSCAPE_TYPES = /\b(Battle|Room)\b/;

/**
 * Whether the shown image is printed sideways, so the card lies landscape
 * when untapped. Scryfall has no flag for this; it stores battle fronts,
 * Rooms, classic split cards and planes as landscape images, and this follows
 * that. Aftermath split cards are printed upright.
 */
export function isLandscape(card: BoardCard): boolean {
  const info = card.scryfallInfo;
  if (card.flipped) {
    const back = backFace(info);
    return !!back && LANDSCAPE_TYPES.test(back.type_line ?? '');
  }
  if (info.layout === 'planar') return true;
  if (info.layout === 'split') return !info.keywords?.includes('Aftermath');
  const front = backFace(info) ? info.card_faces?.[0] : undefined;
  return LANDSCAPE_TYPES.test(front?.type_line ?? info.type_line ?? '');
}

/** Whether the card can be turned 180° (Kamigawa flip cards). */
export function canTurn(card: BoardCard): boolean {
  return card.scryfallInfo.layout === 'flip';
}
