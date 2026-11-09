import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { PRINTINGS_PAGE_SIZE, usePrintings } from '~/features/swapArt';
import { makeScryfallCard } from '../../fixtures/cards';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(respond: (url: URL) => Promise<Response>) {
  const fetch = vi.fn((input: string | URL) => respond(new URL(input)));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function printing(n: number, set = 'abc') {
  return {
    ...makeScryfallCard({ name: 'Bolt' }),
    set,
    collector_number: String(n),
  };
}

describe('usePrintings (#114)', () => {
  it('asks Scryfall for every printing of the exact name, newest first', async () => {
    const fetch = stubFetch(() =>
      Promise.resolve(
        jsonResponse(200, { data: [printing(1)], total_cards: 1 }),
      ),
    );

    const p = usePrintings({ name: 'Bolt "Big"' }, ref(''));
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe(
      'https://api.scryfall.com/cards/search',
    );
    expect(url.searchParams.get('q')).toBe('!"Bolt \\"Big\\""');
    expect(url.searchParams.get('unique')).toBe('prints');
    expect(url.searchParams.get('order')).toBe('released');
    expect(url.searchParams.get('dir')).toBe('desc');
    expect(p.visible.value).toHaveLength(1);
    expect(p.visible.value[0]!.set).toBe('abc');
    expect(p.visible.value[0]!.collectorNumber).toBe('1');
    expect(Object.isFrozen(p.visible.value[0]!.card)).toBe(true);
  });

  it('asks by oracle ID when known, so other cards with that face name stay out', async () => {
    const fetch = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [], total_cards: 0 })),
    );
    const p = usePrintings({ name: 'Bolt', oracleId: 'abc-123' }, ref('m10'));
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe('oracleid:abc-123 e:m10');
  });

  it('filters by set code on the server', async () => {
    const fetch = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [], total_cards: 0 })),
    );
    const set = ref('');
    const p = usePrintings({ name: 'Bolt' }, set);
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    set.value = ' M10 ';
    await nextTick();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const url = new URL(fetch.mock.calls[1]![0]);
    expect(url.searchParams.get('q')).toBe('!"Bolt" e:m10');
  });

  it('ignores characters that are not part of a set code', async () => {
    const fetch = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [], total_cards: 0 })),
    );
    const p = usePrintings({ name: 'Bolt' }, ref('m1) or t:x'));
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe('!"Bolt" e:m1ortx');
  });

  it('treats an unknown set or no matches as an empty result', async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse(400, { object: 'error', code: 'bad' })),
    );
    const p = usePrintings({ name: 'Bolt' }, ref('zzz'));
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    expect(p.visible.value).toEqual([]);
    expect(p.pageCount.value).toBe(0);
  });

  it('shows one page at a time and fetches more from Scryfall when needed', async () => {
    const first = Array.from({ length: PRINTINGS_PAGE_SIZE + 2 }, (_, i) =>
      printing(i),
    );
    const second = [printing(999)];
    const fetch = stubFetch((url) =>
      Promise.resolve(
        url.searchParams.get('page') === '2'
          ? jsonResponse(200, { data: second, total_cards: first.length + 1 })
          : jsonResponse(200, {
              data: first,
              total_cards: first.length + 1,
              has_more: true,
              next_page: 'https://api.scryfall.com/cards/search?q=x&page=2',
            }),
      ),
    );

    const p = usePrintings({ name: 'Bolt' }, ref(''));
    await vi.waitFor(() => expect(p.status.value).toBe('success'));

    expect(p.visible.value).toHaveLength(PRINTINGS_PAGE_SIZE);
    expect(p.pageCount.value).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(1);

    p.page.value = 2;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(p.visible.value).toHaveLength(3));
    expect(p.visible.value.at(-1)!.collectorNumber).toBe('999');
  });

  it('goes back to the first page when the filter changes', async () => {
    const many = Array.from({ length: PRINTINGS_PAGE_SIZE + 1 }, (_, i) =>
      printing(i),
    );
    stubFetch(() =>
      Promise.resolve(
        jsonResponse(200, { data: many, total_cards: many.length }),
      ),
    );
    const set = ref('');
    const p = usePrintings({ name: 'Bolt' }, set);
    await vi.waitFor(() => expect(p.status.value).toBe('success'));
    p.page.value = 2;

    set.value = 'abc';
    await nextTick();

    expect(p.page.value).toBe(1);
  });

  it('reports a failed request as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => Promise.resolve(jsonResponse(500, {})));

    const p = usePrintings({ name: 'Bolt' }, ref(''));
    await vi.waitFor(() => expect(p.status.value).toBe('error'));
  });
});
