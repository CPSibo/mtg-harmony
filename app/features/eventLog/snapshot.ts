import { pickImageUri } from '~/composables/useScryfall';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import type { LoggedCard } from './types';

function isBoardCard(card: BoardCard | ScryfallCard): card is BoardCard {
  return 'scryfallInfo' in card;
}

/** A plain copy of what the log keeps about a card. */
export function snapshotCard(card: BoardCard | ScryfallCard): LoggedCard {
  if (isBoardCard(card)) {
    return {
      instanceId: card.id,
      scryfallId: card.scryfallInfo.id,
      name: card.name,
      imageUri: card.image_uri,
      scryfallUri: card.scryfall_uri,
    };
  }
  return {
    scryfallId: card.id,
    name: card.name,
    imageUri: pickImageUri(card) ?? '',
    scryfallUri: card.scryfall_uri,
  };
}
