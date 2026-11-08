import { describe, expect, it } from 'vitest';
import { pickImageUri } from '~/composables/useScryfall';
import { makeScryfallCard } from '../fixtures/cards';

describe('pickImageUri', () => {
  it('prefers border_crop', () => {
    const card = makeScryfallCard({
      image_uris: { border_crop: 'b', normal: 'n', small: 's' },
    });

    expect(pickImageUri(card)).toBe('b');
  });

  it("uses the front face's image for a double-faced card", () => {
    const card = makeScryfallCard({
      image_uris: undefined,
      card_faces: [
        { name: 'Front', image_uris: { border_crop: 'front' } },
        { name: 'Back', image_uris: { border_crop: 'back' } },
      ],
    });

    expect(pickImageUri(card)).toBe('front');
  });

  it('returns null when no face has an image', () => {
    const card = makeScryfallCard({
      image_uris: undefined,
      card_faces: [{ name: 'Front' }],
    });

    expect(pickImageUri(card)).toBeNull();
  });
});
