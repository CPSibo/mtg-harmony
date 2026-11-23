import { cardData } from '~/features/battlefield/boardCard';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';

let nextId = 0;

/** A minimal Scryfall card with a usable image. */
export function makeScryfallCard(
  overrides: Partial<ScryfallCard> = {},
): ScryfallCard {
  const id = `scryfall-${++nextId}`;
  return {
    id,
    name: `Card ${nextId}`,
    mana_cost: '{1}{R}',
    scryfall_uri: `https://scryfall.com/card/${id}`,
    image_uris: { border_crop: `https://img.example/${id}.jpg` },
    ...overrides,
  } as ScryfallCard;
}

/**
 * A board card, untapped with no modifiers and not in any stack. A `name`
 * override names its Scryfall data too, as on a real card.
 */
export function makeCard({
  name,
  ...overrides
}: Partial<BoardCard> & { name?: string } = {}): BoardCard {
  // Trimmed and frozen, as createBoardCard does.
  const scryfallInfo = cardData(makeScryfallCard(name ? { name } : {}));
  return {
    id: `card-${nextId}`,
    scryfallInfo,
    modifiers: new Map(),
    tapped: false,
    faceNumber: 0,
    ...overrides,
  };
}
