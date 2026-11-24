import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The limiter's state is module-wide, so each test gets a fresh copy.
async function load() {
  vi.resetModules();
  return await import('~/composables/scryfallFetch');
}

let fetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetch = vi.fn(() => Promise.resolve(new Response('{}')));
  vi.stubGlobal('fetch', fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// #158: concurrent callers could fire together, and search bypassed it.
describe('scryfallFetch', () => {
  it('spaces concurrent requests at least the minimum interval apart', async () => {
    const { scryfallFetch, MIN_REQUEST_INTERVAL_MS } = await load();

    const all = Promise.all([
      scryfallFetch('https://api.scryfall.com/a'),
      scryfallFetch('https://api.scryfall.com/b'),
      scryfallFetch('https://api.scryfall.com/c'),
    ]);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS - 1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS);
    expect(fetch).toHaveBeenCalledTimes(3);
    await all;
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.scryfall.com/a',
      'https://api.scryfall.com/b',
      'https://api.scryfall.com/c',
    ]);
  });

  it('passes the request options, abort signal included, to fetch', async () => {
    const { scryfallFetch } = await load();
    const abort = new AbortController();

    await scryfallFetch('https://api.scryfall.com/a', { signal: abort.signal });

    expect(fetch).toHaveBeenCalledWith('https://api.scryfall.com/a', {
      signal: abort.signal,
    });
  });

  it("gives up its turn when aborted while waiting, so it doesn't hold the line", async () => {
    const { scryfallFetch, MIN_REQUEST_INTERVAL_MS } = await load();
    const abort = new AbortController();

    const first = scryfallFetch('https://api.scryfall.com/a');
    const cancelled = scryfallFetch('https://api.scryfall.com/b', {
      signal: abort.signal,
    });
    const rejected = expect(cancelled).rejects.toThrow();
    const third = scryfallFetch('https://api.scryfall.com/c');
    abort.abort();

    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS);
    await Promise.all([first, third, rejected]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.scryfall.com/a',
      'https://api.scryfall.com/c',
    ]);
  });

  it('keeps the line moving after a failed request', async () => {
    const { scryfallFetch, MIN_REQUEST_INTERVAL_MS } = await load();
    fetch.mockRejectedValueOnce(new TypeError('offline'));

    const failed = expect(
      scryfallFetch('https://api.scryfall.com/a'),
    ).rejects.toThrow('offline');
    const next = scryfallFetch('https://api.scryfall.com/b');

    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS);
    await failed;
    await next;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
