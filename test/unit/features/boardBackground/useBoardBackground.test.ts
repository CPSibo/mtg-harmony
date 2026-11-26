import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { BoardColor } from '~/features/boardBackground/colors';
import { useBoardBackground } from '~/features/boardBackground/useBoardBackground';

// happy-dom has no canvas or image decoding: stand in for both.
let made = 0;
vi.mock('~/features/boardBackground/images', () => ({
  bitmapUrl: vi.fn(async () => `blob:spots-${++made}`),
  preloadImages: vi.fn(async () => {}),
}));

let revoke: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => revoke.mockRestore());

function setup({
  on = true,
  picked = [] as BoardColor[],
  wash = true,
  fadeOutMs = 0,
} = {}) {
  const el = document.createElement('div');
  const enabled = ref(on);
  const colors = ref<BoardColor[]>(picked);
  const spotlights = ref(wash);
  const scope = effectScope();
  const bg = scope.run(() =>
    useBoardBackground(
      () => el,
      () => enabled.value,
      () => colors.value,
      () => spotlights.value,
      { fadeOutMs: () => fadeOutMs },
    ),
  )!;
  return { el, enabled, colors, spotlights, scope, bg };
}

const spots = (el: HTMLElement) => el.style.getPropertyValue('--spots-dark');

describe('useBoardBackground', () => {
  it('sets the tiles on the element, with no spotlights for a neutral board', async () => {
    const { el, bg, scope } = setup();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(el.style.getPropertyValue('--tile-dark')).toMatch(
      /^url\("data:image\/svg\+xml,/,
    );
    expect(el.style.getPropertyValue('--tile-size')).toBe('300px');
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
    expect(el.style.getPropertyValue('--tile-size')).toBe('300px');
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(el.style.getPropertyValue('--tile-size')).toBe('1200px');
    expect(el.style.getPropertyValue('--spots-light')).toMatch(/^url\(/);
    scope.stop();
  });

  it('lands on the last of several quick changes', async () => {
    const before = made;
    const { el, colors, bg, scope } = setup({ picked: ['W'], fadeOutMs: 20 });
    colors.value = ['W', 'U', 'B'];
    await nextTick();
    colors.value = [];
    await nextTick();
    await vi.waitFor(() => expect(bg.shown.value).toBe(true));
    expect(el.style.getPropertyValue('--tile-size')).toBe('300px');
    expect(spots(el)).toBe('none');
    // Neither the first build nor the one it skipped keeps its images.
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledTimes(made - before));
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
