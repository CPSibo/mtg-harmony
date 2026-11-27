import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_PREFIX,
  NAVIGATION_TIMEOUT_MS,
  precacheList,
  serviceWorkerSource,
} from '~/pwa/serviceWorker';

describe('precacheList (#169)', () => {
  it('lists the page, bundles, styles, fonts, manifest and icons, sorted', () => {
    const files = precacheList(
      [
        'index.html',
        'assets/index-b.js',
        'assets/index-a.css',
        'assets/mana-x.woff2',
        'sw.js',
        'assets/chunk.js.map',
      ],
      [
        '_headers',
        'favicon.ico',
        'manifest.webmanifest',
        'og-image.png',
        'icons',
        'icons/icon-192.png',
      ],
    );

    expect(files).toEqual([
      '/',
      '/assets/index-a.css',
      '/assets/index-b.js',
      '/assets/mana-x.woff2',
      '/favicon.ico',
      '/icons/icon-192.png',
      '/manifest.webmanifest',
    ]);
  });
});

/** Runs the generated worker against fake service worker globals. */
function runWorker(version = 'v2', files = ['/', '/assets/app.js']) {
  const listeners = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls) store.set(url, new Response(`cached ${url}`));
        },
      };
    }),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (
      request: Request | string,
      options?: { cacheName?: string },
    ) => {
      const path = new URL(
        typeof request === 'string' ? request : request.url,
        'https://app.test',
      ).pathname;
      for (const [name, store] of stores)
        if (!options?.cacheName || options.cacheName === name) {
          const hit = store.get(path);
          if (hit) return hit.clone();
        }
      return undefined;
    },
  };
  const network = vi.fn<(request: Request) => Promise<Response>>();
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: (event: unknown) => void) =>
      listeners.set(type, fn),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  new Function('self', 'caches', 'fetch', serviceWorkerSource(version, files))(
    self,
    caches,
    network,
  );

  /** Dispatches a lifecycle event and waits for its work. */
  async function lifecycle(type: 'install' | 'activate') {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;
  }

  /** Fetches through the worker: its response, or undefined if it passes. */
  async function request(url: string, mode: RequestMode = 'no-cors') {
    let response: Promise<Response> | undefined;
    const req = { url, method: 'GET', mode } as Request;
    listeners.get('fetch')!({
      request: req,
      respondWith: (r: Promise<Response>) => (response = r),
    });
    return response && (await response);
  }

  return { stores, network, self, lifecycle, request };
}

describe('the service worker (#169)', () => {
  it('precaches the shell on install and takes over at once', async () => {
    const sw = runWorker();

    await sw.lifecycle('install');

    expect([...sw.stores.get(`${CACHE_PREFIX}v2`)!.keys()]).toEqual([
      '/',
      '/assets/app.js',
    ]);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('keeps the previous build’s cache and drops older ones', async () => {
    const sw = runWorker('v3');
    for (const v of ['v1', 'v2'])
      sw.stores.set(`${CACHE_PREFIX}${v}`, new Map());
    sw.stores.set('someone-else', new Map());
    await sw.lifecycle('install');

    await sw.lifecycle('activate');

    expect([...sw.stores.keys()].sort()).toEqual([
      `${CACHE_PREFIX}v2`,
      `${CACHE_PREFIX}v3`,
      'someone-else',
    ]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('serves the page from the network when it can', async () => {
    const sw = runWorker();
    await sw.lifecycle('install');
    sw.network.mockResolvedValue(new Response('fresh page'));

    const response = await sw.request('https://app.test/', 'navigate');

    expect(await response!.text()).toBe('fresh page');
  });

  it('serves the cached page offline', async () => {
    const sw = runWorker();
    await sw.lifecycle('install');
    sw.network.mockRejectedValue(new TypeError('Failed to fetch'));

    const response = await sw.request('https://app.test/?game=1', 'navigate');

    expect(await response!.text()).toBe('cached /');
  });

  it('serves the cached page when the network is too slow', async () => {
    vi.useFakeTimers();
    const sw = runWorker();
    await sw.lifecycle('install');
    sw.network.mockReturnValue(new Promise(() => {}));

    const response = sw.request('https://app.test/', 'navigate');
    await vi.advanceTimersByTimeAsync(NAVIGATION_TIMEOUT_MS);

    expect(await (await response)!.text()).toBe('cached /');
  });

  it('serves precached files from the cache, others from the network', async () => {
    const sw = runWorker();
    await sw.lifecycle('install');
    sw.network.mockResolvedValue(new Response('from network'));

    const cached = await sw.request('https://app.test/assets/app.js');
    const other = await sw.request('https://app.test/og-image.png');

    expect(await cached!.text()).toBe('cached /assets/app.js');
    expect(await other!.text()).toBe('from network');
  });

  it('leaves Scryfall and other sites alone', async () => {
    const sw = runWorker();
    await sw.lifecycle('install');

    const response = await sw.request('https://api.scryfall.com/cards/random');

    expect(response).toBeUndefined();
    expect(sw.network).not.toHaveBeenCalled();
  });
});
