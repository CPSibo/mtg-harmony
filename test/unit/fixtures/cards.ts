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

/**
 * A meld pair and the card they meld into, linked through `all_parts` as
 * Scryfall links them (with an unrelated token part, which meld ignores).
 */
export function makeMeldCards() {
  const all_parts = [
    { id: 'bruna-id', component: 'meld_part', name: 'Bruna, the Fading Light' },
    {
      id: 'brisela-id',
      component: 'meld_result',
      name: 'Brisela, Voice of Nightmares',
    },
    {
      id: 'gisela-id',
      component: 'meld_part',
      name: 'Gisela, the Broken Blade',
    },
    { id: 'angel-id', component: 'token', name: 'Angel' },
  ];
  const card = (id: string, name: string) =>
    makeScryfallCard({ id, name, layout: 'meld', all_parts });
  return {
    bruna: card('bruna-id', 'Bruna, the Fading Light'),
    gisela: card('gisela-id', 'Gisela, the Broken Blade'),
    brisela: card('brisela-id', 'Brisela, Voice of Nightmares'),
  };
}
