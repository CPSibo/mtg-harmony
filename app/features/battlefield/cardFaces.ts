import { pickImageUri } from '~/composables/useScryfall';
import { cardImage } from './boardCard';
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

/** Whether the card shows its art: its own choice, else the setting. */
export function showsImage(card: BoardCard, imagesEnabled: boolean): boolean {
  return card.shownAs ? card.shownAs === 'art' : imagesEnabled;
}

/** The image the card shows: its front, its back face, or the standard back. */
export function shownImageUri(card: BoardCard): string {
  if (!card.flipped) return cardImage(card);
  const back = backFace(card.scryfallInfo);
  return (
    (back && pickImageUri({ image_uris: back.image_uris } as ScryfallCard)) ??
    STANDARD_BACK_URI
  );
}

const LANDSCAPE_TYPES = /\b(Battle|Room)\b/;

/**
 * Whether the shown image is printed sideways, so the card lies landscape
 * when untapped. Scryfall has no flag for this, and its images are all
 * portrait, with these cards printed sideways in them; this goes by layout and
 * type line: battle fronts, Rooms, classic split cards and planes. Aftermath split cards are printed upright.
 */
export function isLandscape(card: BoardCard): boolean {
  return isLandscapeFace(card.scryfallInfo, card.flipped);
}

/** `isLandscape` for Scryfall data: its front, or with `flipped`, its back. */
export function isLandscapeFace(info: ScryfallCard, flipped = false): boolean {
  if (flipped) {
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

/**
 * The faces whose text the card shows. A double-faced card shows the face
 * that's up; split, adventure and flip cards print all their halves on one
 * side. A face-down single-faced card shows only the standard back: none.
 */
export function shownFaces(card: BoardCard): ScryfallCardFace[] {
  const info = card.scryfallInfo;
  if (backFace(info)) return [info.card_faces![card.flipped ? 1 : 0]!];
  if (card.flipped) return [];
  return info.card_faces?.length ? [...info.card_faces] : [info];
}
