import { describe, expect, it } from 'vitest';
import { isReactive, reactive } from 'vue';
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

  it('keeps only the Scryfall fields the app uses', () => {
    const scryfallCard = {
      ...makeScryfallCard({
        image_uris: { border_crop: 'b', normal: 'n', small: 's' },
        card_faces: [{ name: 'Front', oracle_text: 'Hi' }],
      }),
      legalities: { modern: 'legal' },
      prices: { usd: '1.00' },
      image_uris_extra: 'x',
    };
    (scryfallCard.image_uris as Record<string, string>).png = 'p';
    (scryfallCard.card_faces![0] as unknown as Record<string, unknown>).artist =
      'A';

    const { scryfallInfo } = createBoardCard(scryfallCard);

    expect(scryfallInfo).toEqual({
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      scryfall_uri: scryfallCard.scryfall_uri,
      image_uris: { border_crop: 'b', normal: 'n', small: 's' },
      card_faces: [{ name: 'Front', oracle_text: 'Hi' }],
    });
  });

  it('keeps the Scryfall data out of Vue reactivity', () => {
    const card = reactive(createBoardCard(makeScryfallCard()));

    expect(isReactive(card.scryfallInfo)).toBe(false);
    expect(Object.isFrozen(card.scryfallInfo)).toBe(true);
  });

  it("keeps each face's images and shows the front of a double-faced card", () => {
    const scryfallCard = makeScryfallCard({
      image_uris: undefined,
      card_faces: [
        {
          name: 'Front',
          image_uris: { border_crop: 'fb', normal: 'fn', small: 'fs' },
        },
        { name: 'Back', image_uris: { border_crop: 'bb' } },
      ],
    });
    (scryfallCard.card_faces![0]!.image_uris as Record<string, string>).png =
      'p';

    const card = createBoardCard(scryfallCard);

    expect(card.image_uri).toBe('fb');
    expect(card.scryfallInfo.card_faces).toEqual([
      {
        name: 'Front',
        image_uris: { border_crop: 'fb', normal: 'fn', small: 'fs' },
      },
      { name: 'Back', image_uris: { border_crop: 'bb' } },
    ]);
  });

  it('leaves image_uri empty when the card has no image', () => {
    const card = createBoardCard(makeScryfallCard({ image_uris: undefined }));

    expect(card.image_uri).toBe('');
  });
});
