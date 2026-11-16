import { describe, expect, it } from 'vitest';
import {
  STANDARD_BACK_URI,
  canTurn,
  isLandscape,
  isLandscapeFace,
  shownImageUri,
} from '~/features/battlefield/cardFaces';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';
import { cardData } from '~/features/battlefield/boardCard';
import { snapshotCard } from '~/features/eventLog/snapshot';
import type { ScryfallCard } from '~/types/Scryfall';

const card = (overrides: Partial<ScryfallCard>) =>
  makeCard({ scryfallInfo: cardData(makeScryfallCard(overrides)) });

const dfc = (frontType: string, backType: string) =>
  card({
    layout: 'transform',
    image_uris: undefined,
    card_faces: [
      {
        name: 'Front',
        type_line: frontType,
        image_uris: { border_crop: 'front.jpg' },
      },
      {
        name: 'Back',
        type_line: backType,
        image_uris: { border_crop: 'back.jpg' },
      },
    ],
  });

describe('shownImageUri', () => {
  it('shows the front image face up', () => {
    const c = makeCard();
    expect(shownImageUri(c)).toBe(c.image_uri);
  });

  it('shows the standard card back when a single-faced card is flipped over', () => {
    expect(shownImageUri({ ...makeCard(), flipped: true })).toBe(
      STANDARD_BACK_URI,
    );
  });

  it("shows a double-faced card's back face when flipped over", () => {
    const c = dfc('Creature — Human', 'Creature — Insect');
    expect(shownImageUri({ ...c, flipped: true })).toBe('back.jpg');
  });
});

describe('isLandscape', () => {
  it('is false for a normal card', () => {
    expect(isLandscape(makeCard())).toBe(false);
  });

  it('is true for a battle front, false for its transformed back', () => {
    const c = dfc('Battle — Siege', 'Creature — Elemental');
    expect(isLandscape(c)).toBe(true);
    expect(isLandscape({ ...c, flipped: true })).toBe(false);
  });

  it('is true for Rooms and classic split cards', () => {
    expect(
      isLandscape(
        card({
          layout: 'split',
          type_line: 'Enchantment — Room // Enchantment — Room',
        }),
      ),
    ).toBe(true);
    expect(
      isLandscape(card({ layout: 'split', type_line: 'Instant // Instant' })),
    ).toBe(true);
  });

  it('is false for Aftermath split cards', () => {
    expect(
      isLandscape(
        card({
          layout: 'split',
          type_line: 'Sorcery // Sorcery',
          keywords: ['Aftermath'],
        }),
      ),
    ).toBe(false);
  });

  it('is true for planes', () => {
    expect(isLandscape(card({ layout: 'planar' }))).toBe(true);
  });

  it('is false when a landscape card is flipped onto the standard back', () => {
    const c = card({ layout: 'split', type_line: 'Instant // Instant' });
    expect(isLandscape({ ...c, flipped: true })).toBe(false);
  });
});

describe('canTurn', () => {
  it('is true only for Kamigawa flip cards', () => {
    expect(canTurn(card({ layout: 'flip' }))).toBe(true);
    expect(canTurn(card({ layout: 'normal' }))).toBe(false);
  });
});

describe('isLandscapeFace', () => {
  it('reads Scryfall data directly, front by default', () => {
    const c = dfc('Battle — Siege', 'Creature — Elemental');
    expect(isLandscapeFace(c.scryfallInfo)).toBe(true);
    expect(isLandscapeFace(c.scryfallInfo, true)).toBe(false);
  });
});

describe('snapshotCard', () => {
  it('marks landscape cards so the log can turn their image', () => {
    expect(snapshotCard(dfc('Battle — Siege', 'Creature')).landscape).toBe(
      true,
    );
    expect(snapshotCard(makeCard()).landscape).toBeUndefined();
  });
});
