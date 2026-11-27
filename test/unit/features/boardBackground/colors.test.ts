import { describe, expect, it } from 'vitest';
import { cardData } from '~/features/battlefield/boardCard';
import {
  colorsOfCards,
  normalizeBoardColors,
} from '~/features/boardBackground/colors';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

describe('normalizeBoardColors', () => {
  it('keeps valid colours once each, in WUBRGC order', () => {
    expect(normalizeBoardColors(['C', 'G', 'x', 'W', 'G', 3])).toEqual([
      'W',
      'G',
      'C',
    ]);
  });
});

const withIdentity = (color_identity?: string[]) =>
  makeCard({
    scryfallInfo: cardData(makeScryfallCard({ color_identity })),
  });

describe('colorsOfCards', () => {
  it('sums the cards’ colour identities, in WUBRGC order', () => {
    expect(
      colorsOfCards([
        withIdentity(['G']),
        withIdentity(['R', 'W']),
        withIdentity(['G', 'W']),
      ]),
    ).toEqual(['W', 'R', 'G']);
  });

  it('counts a colourless card as colourless', () => {
    expect(colorsOfCards([withIdentity([]), withIdentity(['U'])])).toEqual([
      'U',
      'C',
    ]);
  });

  it('skips cards saved without a colour identity', () => {
    expect(colorsOfCards([withIdentity(), withIdentity(['B'])])).toEqual(['B']);
  });

  it('is none for no cards', () => {
    expect(colorsOfCards([])).toEqual([]);
  });
});

describe('cardData', () => {
  it('keeps the colour identity, frozen', () => {
    const data = cardData(makeScryfallCard({ color_identity: ['U', 'B'] }));
    expect(data.color_identity).toEqual(['U', 'B']);
    expect(Object.isFrozen(data.color_identity)).toBe(true);
  });
});
