import { vi } from 'vitest';

/**
 * Replaces the global localStorage with a wrapper around the real one whose
 * `setItem` is a mock. Spying on `Storage.prototype` doesn't work reliably
 * with happy-dom, and the stub is undone after each test (`unstubGlobals`).
 */
export function stubStorage(setItem?: (key: string, value: string) => void) {
  const real = localStorage;
  const mock = vi.fn(
    setItem ?? ((key: string, value: string) => real.setItem(key, value)),
  );
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => real.getItem(key),
    setItem: mock,
    removeItem: (key: string) => real.removeItem(key),
    clear: () => real.clear(),
  });
  return mock;
}
