import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useSmallScreen } from '~/composables/useSmallScreen';

function stubMatchMedia(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width:\s*(\d+(?:\.\d+)?)px/.exec(query)?.[1]);
    return {
      matches: width <= max,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

describe('useSmallScreen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is true below the md breakpoint', () => {
    stubMatchMedia(767);
    const scope = effectScope();
    const small = scope.run(() => useSmallScreen())!;
    expect(small.value).toBe(true);
    scope.stop();
  });

  it('is false from the md breakpoint up', () => {
    stubMatchMedia(768);
    const scope = effectScope();
    const small = scope.run(() => useSmallScreen())!;
    expect(small.value).toBe(false);
    scope.stop();
  });
});
