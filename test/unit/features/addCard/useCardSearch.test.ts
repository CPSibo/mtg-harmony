import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useCardSearch } from '~/features/addCard';
import { makeScryfallCard } from '../../fixtures/cards';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(
  respond: (url: URL, init?: RequestInit) => Promise<Response>,
) {
  const fetch = vi.fn((input: string | URL, init?: RequestInit) =>
    respond(new URL(input), init),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('useCardSearch', () => {
  it('does not search for an empty or blank term', async () => {
    const fetch = stubFetch(() => Promise.reject(new Error('unexpected')));
    const term = ref('');

    const search = useCardSearch(term);
    term.value = '   ';
    await nextTick();

    expect(fetch).not.toHaveBeenCalled();
    expect(search.status.value).toBe('idle');
    expect(search.cards.value).toEqual([]);
  });

  it('searches Scryfall for the trimmed term', async () => {
    const card = makeScryfallCard({ name: 'Pacifism' });
    const fetch = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [card] })),
    );

    const search = useCardSearch(ref('  pacifism '));
    expect(search.status.value).toBe('pending');
    await vi.waitFor(() => expect(search.status.value).toBe('success'));

    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe(
      'https://api.scryfall.com/cards/search',
    );
    expect(url.searchParams.get('q')).toBe('pacifism');
    expect(search.cards.value.map((c) => c.name)).toEqual(['Pacifism']);
  });

  it('treats "no matches" (404) as an empty result, not an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() =>
      Promise.resolve(
        jsonResponse(404, { object: 'error', code: 'not_found' }),
      ),
    );

    const search = useCardSearch(ref('zzzz'));
    await vi.waitFor(() => expect(search.status.value).toBe('success'));

    expect(search.cards.value).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  it('reports other HTTP errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => Promise.resolve(jsonResponse(500, { object: 'error' })));

    const search = useCardSearch(ref('ooze'));
    await vi.waitFor(() => expect(search.status.value).toBe('error'));

    expect(search.cards.value).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  it('reports network failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const search = useCardSearch(ref('ooze'));

    await vi.waitFor(() => expect(search.status.value).toBe('error'));
  });

  it('cancels the previous search and ignores its result', async () => {
    const slow = makeScryfallCard({ name: 'Slow' });
    const fast = makeScryfallCard({ name: 'Fast' });
    const signals: AbortSignal[] = [];
    let finishSlow!: () => void;
    stubFetch((url, init) => {
      signals.push(init!.signal!);
      if (url.searchParams.get('q') === 'slow')
        return new Promise((resolve) => {
          finishSlow = () => resolve(jsonResponse(200, { data: [slow] }));
        });
      return Promise.resolve(jsonResponse(200, { data: [fast] }));
    });
    const term = ref('slow');

    const search = useCardSearch(term);
    term.value = 'fast';
    await vi.waitFor(() => expect(search.status.value).toBe('success'));
    finishSlow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(signals[0]!.aborted).toBe(true);
    expect(search.cards.value.map((c) => c.name)).toEqual(['Fast']);
  });

  it('clears the results when the term is cleared', async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [makeScryfallCard()] })),
    );
    const term = ref('ooze');
    const search = useCardSearch(term);
    await vi.waitFor(() => expect(search.status.value).toBe('success'));

    term.value = '';
    await nextTick();

    expect(search.cards.value).toEqual([]);
    expect(search.status.value).toBe('idle');
  });
});
