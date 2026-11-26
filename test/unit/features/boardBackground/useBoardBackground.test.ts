import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { BoardColor } from '~/features/boardBackground/colors';
import { useBoardBackground } from '~/features/boardBackground/useBoardBackground';

function setup() {
  const el = document.createElement('div');
  const enabled = ref(true);
  const colors = ref<BoardColor[]>([]);
  const scope = effectScope();
  scope.run(() =>
    useBoardBackground(
      () => el,
      () => enabled.value,
      () => colors.value,
    ),
  );
  return { el, enabled, colors, scope };
}

describe('useBoardBackground', () => {
  it('sets the tiles on the element, with no spotlights for a neutral board', () => {
    const { el, scope } = setup();
    expect(el.style.getPropertyValue('--tile-dark')).toMatch(
      /^url\("data:image\/svg\+xml,/,
    );
    expect(el.style.getPropertyValue('--tile-size')).toBe('300px');
    expect(el.style.getPropertyValue('--spots-dark')).toBe('none');
    scope.stop();
  });

  it('rebuilds when the colours change', async () => {
    const { el, colors, scope } = setup();
    colors.value = ['W', 'U', 'B'];
    await nextTick();
    expect(el.style.getPropertyValue('--tile-size')).toBe('1200px');
    expect(el.style.getPropertyValue('--spots-light')).toMatch(/^url\(/);
    scope.stop();
  });

  it('clears everything when turned off', async () => {
    const { el, enabled, scope } = setup();
    enabled.value = false;
    await nextTick();
    expect(el.getAttribute('style') ?? '').toBe('');
    scope.stop();
  });

  it("doesn't re-set values that haven't changed", async () => {
    const { el, colors, scope } = setup();
    const set = vi.spyOn(el.style, 'setProperty');
    colors.value = [];
    await nextTick();
    expect(set).not.toHaveBeenCalled();
    scope.stop();
  });
});
