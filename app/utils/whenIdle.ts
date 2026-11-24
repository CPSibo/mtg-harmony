/** How long to wait where the browser can't say when it's idle. */
export const IDLE_FALLBACK_MS = 1500;

/**
 * Runs `fn` when the browser is idle. Safari (so every iPhone and iPad) has
 * no `requestIdleCallback`, so there it runs after a short delay instead,
 * once startup work is likely done (#164).
 */
export function whenIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function')
    window.requestIdleCallback(() => fn());
  else setTimeout(fn, IDLE_FALLBACK_MS);
}
