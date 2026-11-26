import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { BoardColor } from '~/features/boardBackground/colors';
import { rasterUrl } from '~/features/boardBackground/images';
import { useBoardBackground } from '~/features/boardBackground/useBoardBackground';

// happy-dom has no canvas or image decoding: stand in for both. Tiles are
// named after their size in pixels.
let made = 0;
const created: string[] = [];
const blob = (name: string) => {
  const url = `blob:${name}-${++made}`;
  created.push(url);
  return url;
};
vi.mock('~/features/boardBackground/images', () => ({
  bitmapUrl: vi.fn(async () => blob('spots')),
  rasterUrl: vi.fn(async (_svg: string, px: number) => blob(`tile-${px}`)),
  preloadImages: vi.fn(async () => {}),
}));

let revoke: MockInstance<typeof URL.revokeObjectURL>;
beforeEach(() => {
  created.length = 0;
  revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  revoke.mockRestore();
  vi.mocked(rasterUrl).mockClear();
});

/** Blob URLs made but neither shown on `el` nor revoked. */
function leaked(el: HTMLElement) {
  const style = el.getAttribute('style') ?? '';
  const revoked = new Set(revoke.mock.calls.map(([url]) => url));
  return created.filter((url) => !style.includes(url) && !revoked.has(url));
}

function setup({
  on = true,
  picked = [] as BoardColor[],
  wash = true,
  fadeOutMs = 0,
  detail = 1,
} = {}) {
  const el = document.createElement('div');
  const enabled = ref(on);
  const colors = ref<BoardColor[]>(picked);
  const spotlights = ref(wash);
  const resolution = ref(detail);
  const scope = effectScope();
  const bg = scope.run(() =>
    useBoardBackground(
      () => el,
      () => enabled.value,
      () => colors.value,
      () => spotlights.value,
      {
        fadeOutMs: () => fadeOutMs,
        resolution: () => resolution.value,
        settleMs: 0,
      },
    ),
  )!;
  return { el, enabled, colors, spotlights, resolution, scope, bg };
}

const spots = (el: HTMLElement) => el.style.getPropertyValue('--spots-dark');
const tile = (el: HTMLElement) => el.style.getPropertyValue('--tile-dark');

describe('useBoardBackground', () => {
  it('sets the tiles on the element, with no spotlights for a neutral board', async () => {
    const { el, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(tile(el)).toMatch(/^url\("blob:tile-200-\d+"\)$/);
    expect(el.style.getPropertyValue('--tile-light')).toMatch(/blob:tile-200-/);
    expect(el.style.getPropertyValue('--tile-size')).toBe('200px');
    expect(spots(el)).toBe('none');
    expect(bg.themed.value).toBe(true);
    scope.stop();
  });

  it('stays hidden until its images are ready', async () => {
    const { el, bg, scope } = setup({ picked: ['W'] });
    expect(bg.shown.value).toBe(false);
    expect(spots(el)).toBe('');
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(spots(el)).toMatch(/^url\("blob:spots-\d+"\)$/);
    scope.stop();
  });

  it('leaves out the spotlights while the colour wash is off', async () => {
    const { el, spotlights, bg, scope } = setup({ picked: ['W'], wash: false });
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(spots(el)).toBe('none');
    expect(el.style.getPropertyValue('--tile-size')).not.toBe('');
    spotlights.value = true;
    await vi.waitFor(() => expect(spots(el)).toMatch(/^url\("blob:/));
    scope.stop();
  });

  it('falls back to the SVG tiles where it can’t rasterise them', async () => {
    vi.mocked(rasterUrl).mockResolvedValue(null);
    const { el, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(tile(el)).toMatch(/^url\("data:image\/svg\+xml,/);
    vi.mocked(rasterUrl).mockReset();
    vi.mocked(rasterUrl).mockImplementation(async (_svg, px) =>
      blob(`tile-${px}`),
    );
    scope.stop();
  });

  it('re-renders the tiles in steps as the zoom needs more detail, without fading', async () => {
    const { el, resolution, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    const first = tile(el).slice(5, -2);
    resolution.value = 1.2;
    await nextTick();
    expect(bg.shown.value).toBe(true);
    // The next step up is √2 device px per board px.
    await vi.waitFor(() => expect(tile(el)).toMatch(/blob:tile-283-/));
    expect(bg.shown.value).toBe(true);
    expect(revoke).toHaveBeenCalledWith(first);
    const calls = vi.mocked(rasterUrl).mock.calls.length;
    resolution.value = 1.3;
    await nextTick();
    await new Promise((done) => setTimeout(done, 20));
    expect(vi.mocked(rasterUrl).mock.calls.length).toBe(calls);
    expect(leaked(el)).toEqual([]);
    scope.stop();
  });

  it('caps the tiles’ size in pixels', async () => {
    const { bg, scope } = setup({ picked: ['W', 'U', 'B'], detail: 40 });
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    for (const [, px] of vi.mocked(rasterUrl).mock.calls)
      expect(px).toBeLessThanOrEqual(4096);
    scope.stop();
  });

  it('frees every image when stopped', async () => {
    const { el, bg, scope } = setup({ picked: ['W'] });
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    scope.stop();
    el.removeAttribute('style');
    expect(leaked(el)).toEqual([]);
  });

  it('shows the grid straight away while the background is off', () => {
    const { el, bg, scope } = setup({ on: false });
    expect(bg.shown.value).toBe(true);
    expect(bg.themed.value).toBe(false);
    expect(el.getAttribute('style') ?? '').toBe('');
    scope.stop();
  });

  it('fades out, swaps, then fades back in when the colours change', async () => {
    const { el, colors, bg, scope } = setup({ fadeOutMs: 40 });
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    colors.value = ['W', 'U', 'B'];
    await nextTick();
    expect(bg.shown.value).toBe(false);
    // Still the old background while it fades out.
    expect(el.style.getPropertyValue('--tile-size')).toBe('200px');
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(el.style.getPropertyValue('--tile-size')).toBe('800px');
    expect(el.style.getPropertyValue('--spots-light')).toMatch(/^url\(/);
    scope.stop();
  });

  it('lands on the last of several quick changes', async () => {
    const { el, colors, bg, scope } = setup({ picked: ['W'], fadeOutMs: 20 });
    colors.value = ['W', 'U', 'B'];
    await nextTick();
    colors.value = [];
    await nextTick();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(el.style.getPropertyValue('--tile-size')).toBe('200px');
    expect(spots(el)).toBe('none');
    // Neither the first build nor the one it skipped keeps its images.
    await vi.waitFor(() => expect(leaked(el)).toEqual([]));
    scope.stop();
  });

  it('frees spotlight images it no longer shows', async () => {
    const { el, colors, bg, scope } = setup({ picked: ['W'] });
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    const first = spots(el).slice(5, -2);
    colors.value = ['U'];
    await nextTick();
    await vi.waitFor(() => expect(spots(el).slice(5, -2)).not.toBe(first));
    expect(revoke).toHaveBeenCalledWith(first);
    const second = spots(el).slice(5, -2);
    scope.stop();
    expect(revoke).toHaveBeenCalledWith(second);
  });

  it('clears everything when turned off', async () => {
    const { el, enabled, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    enabled.value = false;
    await vi.waitFor(() => expect(bg.themed.value).toBe(false));
    expect(el.getAttribute('style') ?? '').toBe('');
    expect(bg.shown.value).toBe(true);
    scope.stop();
  });

  it("doesn't rebuild or re-set values that haven't changed", async () => {
    const { el, colors, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    const set = vi.spyOn(el.style, 'setProperty');
    colors.value = [];
    await nextTick();
    expect(bg.shown.value).toBe(true);
    expect(set).not.toHaveBeenCalled();
    scope.stop();
  });
});
