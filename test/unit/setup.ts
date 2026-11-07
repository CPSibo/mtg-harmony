import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, vi } from 'vitest';
import { flushSaves } from '~/composables/useLocalStorage';

// Each test gets empty storage (no pending saves), real timers and a fresh Pinia, so stores
// start from their defaults.
beforeEach(() => {
  // Saves are debounced at module level; don't let one test's land in the next.
  flushSaves();
  localStorage.clear();
  vi.useRealTimers();
  setActivePinia(createPinia());
});
