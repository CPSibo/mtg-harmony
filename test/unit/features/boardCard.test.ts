import { describe, expect, it } from 'vitest';
import { isReactive, reactive } from 'vue';
import {
  cardImage,
  createBoardCard,
  entersPrepared,
} from '~/features/battlefield';
import { makeScryfallCard } from '../fixtures/cards';

describe('createBoardCard', () => {
  it('builds an untapped card from Scryfall data', () => {
    const scryfallCard = makeScryfallCard({ name: 'Pacifism' });

    const card = createBoardCard(scryfallCard);

    expect(card).toMatchObject({
      scryfallInfo: scryfallCard,
      tapped: false,
      faceNumber: 0,
    });
    expect(cardImage(card)).toBe(scryfallCard.image_uris!.border_crop);
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

  it('keeps the layout and keywords, which set how the card lies', () => {
    const { scryfallInfo } = createBoardCard(
      makeScryfallCard({ layout: 'split', keywords: ['Aftermath'] }),
    );

    expect(scryfallInfo.layout).toBe('split');
    expect(scryfallInfo.keywords).toEqual(['Aftermath']);
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

  // #155: name, cost, image and link come from the Scryfall data, not copies.
  it('keeps no copies of the Scryfall fields on the card', () => {
    const card = createBoardCard(makeScryfallCard());

    expect(Object.keys(card).sort()).toEqual(
      ['faceNumber', 'id', 'modifiers', 'scryfallInfo', 'tapped'].sort(),
    );
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

    expect(cardImage(card)).toBe('fb');
    expect(card.scryfallInfo.card_faces).toEqual([
      {
        name: 'Front',
        image_uris: { border_crop: 'fb', normal: 'fn', small: 'fs' },
      },
      { name: 'Back', image_uris: { border_crop: 'bb' } },
    ]);
  });

  it('has an empty image when the card has none', () => {
    const card = createBoardCard(makeScryfallCard({ image_uris: undefined }));

    expect(cardImage(card)).toBe('');
  });
});

// #146: preparation cards can enter with their spell ready to cast.
describe('entersPrepared', () => {
  it('spots a card that says it enters prepared', () => {
    expect(
      entersPrepared(
        makeScryfallCard({
          oracle_text: 'Flying\nThis creature enters prepared.',
        }),
      ),
    ).toBe(true);
  });

  it("spots it on the first face, or by the card's own name", () => {
    expect(
      entersPrepared(
        makeScryfallCard({
          card_faces: [
            { name: 'Scholar', oracle_text: 'This creature enters prepared.' },
            { name: 'Lesson', oracle_text: 'Draw two cards.' },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      entersPrepared(
        makeScryfallCard({
          name: 'Eager Scholar',
          oracle_text: 'Eager Scholar enters prepared.',
        }),
      ),
    ).toBe(true);
  });

  it('knows a legend by the part of its name before the comma', () => {
    expect(
      entersPrepared(
        makeScryfallCard({
          name: "Jadzi, Steward of Fate // Oracle's Gift",
          card_faces: [
            {
              name: 'Jadzi, Steward of Fate',
              oracle_text: 'Jadzi enters prepared.',
            },
            { name: "Oracle's Gift", oracle_text: 'Create X tokens.' },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('counts a condition before it in the same sentence', () => {
    expect(
      entersPrepared(
        makeScryfallCard({
          oracle_text: 'If this creature was kicked, it enters prepared.',
        }),
      ),
    ).toBe(true);
  });

  it('ignores other cards entering prepared, and other sentences', () => {
    expect(
      entersPrepared(
        makeScryfallCard({
          oracle_text:
            'Whenever another creature you control enters prepared, draw a card.',
        }),
      ),
    ).toBe(false);
    expect(
      entersPrepared(
        makeScryfallCard({
          oracle_text:
            'When this creature enters, scry 1. It becomes prepared.',
        }),
      ),
    ).toBe(false);
    expect(entersPrepared(makeScryfallCard())).toBe(false);
  });

  it('puts the Prepared counter on such a card as it is made', () => {
    const card = createBoardCard(
      makeScryfallCard({ oracle_text: 'This creature enters prepared.' }),
    );

    expect([...card.modifiers]).toEqual([['prepared', 1]]);
  });
});
