import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedData } from '~/utils/saveData';

/** Stubs the browser's data-saving signals. */
function stubPreference({
  reducedData = false,
  saveData,
}: {
  reducedData?: boolean;
  saveData?: boolean;
}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedData && query === '(prefers-reduced-data: reduce)',
  }));
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: saveData === undefined ? undefined : { saveData },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'connection');
});

// #242
describe('prefersReducedData', () => {
  it('is false when the browser asks for nothing', () => {
    stubPreference({ saveData: false });
    expect(prefersReducedData()).toBe(false);
  });

  it('follows prefers-reduced-data', () => {
    stubPreference({ reducedData: true });
    expect(prefersReducedData()).toBe(true);
  });

  it("follows Chromium's Save-Data", () => {
    stubPreference({ saveData: true });
    expect(prefersReducedData()).toBe(true);
  });

  it('is false where neither API exists', () => {
    vi.stubGlobal('matchMedia', undefined);
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: undefined,
    });
    expect(prefersReducedData()).toBe(false);
  });
});
