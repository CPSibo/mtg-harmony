import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCardById } from '~/composables/useScryfall';
import { makeScryfallCard } from '../fixtures/cards';

describe('fetchCardById (#143)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches one card by its Scryfall ID', async () => {
    const card = makeScryfallCard({ id: 'brisela-id' });
    const fetch = vi.fn(async () => new Response(JSON.stringify(card)));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchCardById('brisela-id')).resolves.toEqual(card);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/brisela-id',
    );
  });

  it('throws on an error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );

    await expect(fetchCardById('missing')).rejects.toThrow('HTTP 404');
  });
});
