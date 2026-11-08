import type { useEventLogStore } from './store';

/** How long without events before the app offers a new game. */
export const IDLE_PROMPT_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Whether to offer a new game: the last event is over 2 hours old, isn't
 * already a new game, and the offer wasn't dismissed since.
 */
export function shouldOfferNewGame(
  log: Pick<
    ReturnType<typeof useEventLogStore>,
    'entries' | 'newGameOfferDismissedAt'
  >,
  now = Date.now(),
): boolean {
  const last = log.entries.at(-1);
  if (!last || last.type === 'gameMarker') return false;
  if (now - last.at < IDLE_PROMPT_AFTER_MS) return false;
  const dismissed = log.newGameOfferDismissedAt;
  return dismissed === null || dismissed < last.at;
}
