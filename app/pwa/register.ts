/**
 * Registers the service worker (`/sw.js`, #169) in production builds, once the
 * page has loaded so it doesn't compete with startup. The dev server has none.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker (private mode, say): the app still works online.
    });
  });
}
