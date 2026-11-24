import { useToast } from '@nuxt/ui/composables';
import { useEventListener, useIntervalFn } from '@vueuse/core';
import { flushSaves } from '~/composables/useLocalStorage';
import { whenIdle } from '~/utils/whenIdle';

/** A build of the app, as `/version.json` describes it (see `vite.config.ts`). */
export interface Build {
  version: string;
  /** Short commit, or '' if the build knew none. */
  commit: string;
}

/** How often an open, visible tab checks for a new build. */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** The least time between two checks, however often the tab comes back. */
export const MIN_CHECK_GAP_MS = 60 * 1000;

/** This build, as Vite's `define` set it. */
export const THIS_BUILD: Build = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
};

/**
 * Whether `reply` (the parsed `/version.json`) is a different build from
 * `current`. The commit only counts when both builds know theirs.
 */
export function isNewBuild(current: Build, reply: unknown): reply is Build {
  if (typeof reply !== 'object' || reply === null) return false;
  const { version, commit } = reply as Partial<Build>;
  if (typeof version !== 'string') return false;
  if (version !== current.version) return true;
  return (
    typeof commit === 'string' &&
    !!commit &&
    !!current.commit &&
    commit !== current.commit
  );
}

const TOAST_ID = 'new-version';

/**
 * Tells a long-open tab when a new build is deployed (#206). It fetches
 * `/version.json` once the page is idle after load, whenever the tab comes back
 * into view, and hourly while it's visible, at most once a minute. A new build
 * gets a toast that stays until Refresh or Dismiss. Each new build is toasted
 * once. Offline, or on a bad reply, it says nothing.
 *
 * Production builds only: the dev server has no `version.json`.
 */
export function useUpdateCheck({
  current = THIS_BUILD,
  enabled = import.meta.env.PROD,
}: { current?: Build; enabled?: boolean } = {}) {
  if (!enabled) return;
  const toast = useToast();
  let lastCheck = -Infinity;
  let toasted = '';

  async function check() {
    if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
    lastCheck = Date.now();
    let reply: unknown;
    try {
      const response = await fetch('/version.json', { cache: 'no-store' });
      if (!response.ok) return;
      reply = await response.json();
    } catch {
      return; // Offline or not JSON: try again next time.
    }
    if (!isNewBuild(current, reply)) return;
    const key = `${reply.version} ${reply.commit}`;
    if (key === toasted) return;
    toasted = key;
    toast.add({
      id: TOAST_ID,
      title: 'A new version of MTG Harmony is available',
      description: 'Refresh to update. Your game is saved.',
      icon: 'i-lucide-refresh-cw',
      duration: 0,
      close: false,
      actions: [
        {
          label: 'Refresh',
          onClick: () => {
            // Saves are debounced; write the last change before reloading.
            flushSaves();
            window.location.reload();
          },
        },
        { label: 'Dismiss', color: 'neutral', variant: 'outline' },
      ],
    });
  }

  whenIdle(() => void check());
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  useIntervalFn(() => {
    if (document.visibilityState === 'visible') void check();
  }, CHECK_INTERVAL_MS);
}
