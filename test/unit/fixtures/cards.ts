import type { BoardCard, BoardCardModifier } from '~/types/PlayArea';
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

/** A board card, untapped with no modifiers and not in any stack. */
export function makeCard(overrides: Partial<BoardCard> = {}): BoardCard {
  const scryfallInfo = makeScryfallCard();
  return {
    id: scryfallInfo.id,
    scryfallInfo,
    name: scryfallInfo.name,
    mana_cost: scryfallInfo.mana_cost,
    image_uri: scryfallInfo.image_uris!.border_crop!,
    scryfall_uri: scryfallInfo.scryfall_uri,
    modifiers: new Set<BoardCardModifier>(),
    tapped: false,
    faceNumber: 0,
    ...overrides,
  };
}
