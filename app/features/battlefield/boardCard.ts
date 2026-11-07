import { pickImageUri } from '~/composables/useScryfall';
import type { BoardCard, BoardCardModifier } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import { randomUUID } from '~/utils/randomUUID';

/**
 * A new card instance for a Scryfall card: untapped, no modifiers, in no
 * stack. Every call gets its own ID, so copies of the same token stay apart.
 * The Scryfall ID stays on `scryfallInfo.id`.
 */
export function createBoardCard(scryfallCard: ScryfallCard): BoardCard {
  return {
    id: randomUUID(),
    scryfallInfo: scryfallCard,
    name: scryfallCard.name,
    mana_cost: scryfallCard.mana_cost,
    image_uri: pickImageUri(scryfallCard) ?? '',
    scryfall_uri: scryfallCard.scryfall_uri,
    modifiers: new Set<BoardCardModifier>(),
    tapped: false,
    faceNumber: 0,
  };
}
