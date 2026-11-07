import { describe, expect, it } from 'vitest';
import { createBoardCard } from '~/features/battlefield';
import { makeScryfallCard } from '../fixtures/cards';

describe('createBoardCard', () => {
  it('builds an untapped card from Scryfall data', () => {
    const scryfallCard = makeScryfallCard({ name: 'Pacifism' });

    const card = createBoardCard(scryfallCard);

    expect(card).toMatchObject({
      scryfallInfo: scryfallCard,
      name: 'Pacifism',
      mana_cost: scryfallCard.mana_cost,
      scryfall_uri: scryfallCard.scryfall_uri,
      image_uri: scryfallCard.image_uris!.border_crop,
      tapped: false,
      faceNumber: 0,
    });
    expect(card.modifiers.size).toBe(0);
    expect(card.stack).toBeUndefined();
  });

  // #23: the ID used to be the Scryfall ID, so copies of a token collided.
  it('gives every card its own ID, separate from the Scryfall ID', () => {
    const scryfallCard = makeScryfallCard();

    const a = createBoardCard(scryfallCard);
    const b = createBoardCard(scryfallCard);

    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(scryfallCard.id);
    expect(a.scryfallInfo.id).toBe(scryfallCard.id);
  });

  it('leaves image_uri empty when the card has no image', () => {
    const card = createBoardCard(makeScryfallCard({ image_uris: undefined }));

    expect(card.image_uri).toBe('');
  });
});
