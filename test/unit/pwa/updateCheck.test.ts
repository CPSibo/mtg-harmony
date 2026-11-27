import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  CHECK_INTERVAL_MS,
  MIN_CHECK_GAP_MS,
  isNewBuild,
  useUpdateCheck,
} from '~/pwa/updateCheck';

type Toast = {
  id?: string;
  title?: string;
  duration?: number;
  actions?: { label?: string; onClick?: () => void }[];
};
const toasts: Toast[] = [];
vi.mock('@nuxt/ui/composables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/ui/composables')>()),
  useToast: () => ({ add: (toast: Toast) => toasts.push(toast) }),
}));

const flushSaves = vi.fn();
vi.mock('~/composables/useLocalStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/composables/useLocalStorage')>()),
  flushSaves: () => flushSaves(),
}));

const current = { version: '0.9.1', commit: 'abc1234' };

describe('isNewBuild (#206)', () => {
  it('is false for the same version and commit', () => {
    expect(isNewBuild(current, { version: '0.9.1', commit: 'abc1234' })).toBe(
      false,
    );
  });

  it('is true when the version or the commit differs', () => {
    expect(isNewBuild(current, { version: '0.9.2', commit: 'abc1234' })).toBe(
      true,
    );
    expect(isNewBuild(current, { version: '0.9.1', commit: 'def5678' })).toBe(
      true,
    );
  });

  it('ignores the commit when either build has none', () => {
    expect(isNewBuild(current, { version: '0.9.1', commit: '' })).toBe(false);
    expect(
      isNewBuild(
        { version: '0.9.1', commit: '' },
        { version: '0.9.1', commit: 'x' },
      ),
    ).toBe(false);
  });

  it.each([null, 'nope', {}, { version: 1 }, { commit: 'abc1234' }])(
    'is false for a reply that is not a build: %j',
    (reply) => {
      expect(isNewBuild(current, reply)).toBe(false);
    },
  );
});

describe('useUpdateCheck (#206)', () => {
  let served: unknown;
  const fetchMock = vi.fn(async () => {
    if (served instanceof Error) throw served;
    return new Response(JSON.stringify(served));
  });
  let scope: ReturnType<typeof effectScope>;

  function start() {
    scope = effectScope();
    scope.run(() => useUpdateCheck({ current, enabled: true }));
  }

  async function returnToTab() {
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
  }

  beforeEach(() => {
    toasts.length = 0;
    served = current;
    fetchMock.mockClear();
    flushSaves.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => scope?.stop());

  it('checks once the page is idle after load, without the HTTP cache', async () => {
    start();
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store',
    });
    expect(toasts).toEqual([]);
  });

  it('shows a toast that stays until acted on when a new build is out', async () => {
    served = { version: '0.9.2', commit: 'def5678' };
    start();
    await vi.runOnlyPendingTimersAsync();

    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      title: 'A new version of MTG Harmony is available',
      duration: 0,
    });
    expect(toasts[0]!.actions?.map((a) => a.label)).toEqual([
      'Refresh',
      'Dismiss',
    ]);
  });

  it('saves before reloading on Refresh', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    served = { version: '0.9.2', commit: 'def5678' };
    start();
    await vi.runOnlyPendingTimersAsync();

    toasts[0]!.actions![0]!.onClick!();

    expect(flushSaves).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(flushSaves.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0]!,
    );
  });

  it('checks again on returning to the tab, but not more than once a minute', async () => {
    start();
    await vi.runOnlyPendingTimersAsync();
    fetchMock.mockClear();

    await returnToTab();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MIN_CHECK_GAP_MS);
    await returnToTab();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('checks every hour while the tab stays open', async () => {
    start();
    await vi.runOnlyPendingTimersAsync();
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't toast the same new build twice, but does toast a newer one", async () => {
    served = { version: '0.9.2', commit: 'def5678' };
    start();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(toasts).toHaveLength(1);

    served = { version: '0.9.3', commit: '0123456' };
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(toasts).toHaveLength(2);
  });

  it('stays quiet offline', async () => {
    served = new TypeError('Failed to fetch');
    start();
    await vi.runOnlyPendingTimersAsync();

    expect(toasts).toEqual([]);
  });

  it('does nothing when disabled, as on the dev server', async () => {
    scope = effectScope();
    scope.run(() => useUpdateCheck({ current, enabled: false }));
    await vi.runOnlyPendingTimersAsync();
    await returnToTab();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
