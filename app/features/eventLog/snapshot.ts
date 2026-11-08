import { pickImageUri } from '~/composables/useScryfall';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import type { LoggedCard, LoggedCardText } from './types';

function textOf(card: ScryfallCard): LoggedCardText {
  const { mana_cost, type_line, oracle_text, power, toughness, card_faces } =
    card;
  return {
    mana_cost,
    type_line,
    oracle_text,
    power,
    toughness,
    // Text only: the log keeps the shown image once, as `imageUri`.
    card_faces: card_faces?.map(({ image_uris: _, ...text }) => text),
  };
}

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
      text: textOf(card.scryfallInfo),
    };
  }
  return {
    scryfallId: card.id,
    name: card.name,
    imageUri: pickImageUri(card) ?? '',
    scryfallUri: card.scryfall_uri,
    text: textOf(card),
  };
}
