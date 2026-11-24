import { describe, expect, it } from 'vitest';
import { cardData } from '~/features/battlefield';
import { findMeldPartner, meldResult } from '~/features/battlefield/meld';
import {
  makeCard,
  makeMeldCards,
  makeScryfallCard,
} from '../../fixtures/cards';
import type { ScryfallCard } from '~/types/Scryfall';

/** A board card for Scryfall data, as on the board. */
function boardCard(info: ScryfallCard) {
  const card = makeCard({ name: info.name });
  return { ...card, scryfallInfo: cardData(info) };
}

describe('meld (#143)', () => {
  it('keeps only the meld parts of all_parts', () => {
    const { bruna } = makeMeldCards();

    expect(cardData(bruna).all_parts).toEqual([
      {
        id: 'bruna-id',
        component: 'meld_part',
        name: 'Bruna, the Fading Light',
      },
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
    ]);
  });

  it('drops all_parts from cards that do not meld', () => {
    const card = makeScryfallCard({
      all_parts: [{ id: 't', component: 'token', name: 'Angel' }],
    });

    expect(cardData(card).all_parts).toBeUndefined();
  });

  it('finds what a meld half melds into', () => {
    const { bruna, brisela } = makeMeldCards();

    expect(meldResult(cardData(bruna))).toEqual({
      id: 'brisela-id',
      component: 'meld_result',
      name: 'Brisela, Voice of Nightmares',
    });
    expect(meldResult(cardData(brisela))).toBeUndefined();
    expect(meldResult(cardData(makeScryfallCard()))).toBeUndefined();
  });

  it('finds the other half among the cards, by name', () => {
    const { bruna, gisela } = makeMeldCards();
    const half = boardCard(bruna);
    const other = boardCard({ ...gisela, id: 'another-printing' });

    expect(
      findMeldPartner(half, [half, boardCard(makeScryfallCard()), other]),
    ).toBe(other);
  });

  it('does not pair a half with itself or with another copy of itself', () => {
    const { bruna } = makeMeldCards();
    const half = boardCard(bruna);

    expect(findMeldPartner(half, [half, boardCard(bruna)])).toBeUndefined();
  });
});
