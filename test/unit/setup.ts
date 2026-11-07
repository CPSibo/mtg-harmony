import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, vi } from 'vitest';

// Each test gets empty storage, real timers and a fresh Pinia, so stores
// start from their defaults.
beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  setActivePinia(createPinia());
});
