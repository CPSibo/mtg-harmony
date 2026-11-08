import { describe, expect, it, vi } from 'vitest';
import {
  IDLE_PROMPT_AFTER_MS,
  shouldOfferNewGame,
  useEventLogStore,
} from '~/features/eventLog';
import { makeCard } from '../../fixtures/cards';

const HOUR = 60 * 60 * 1000;

describe('shouldOfferNewGame', () => {
  it('is 2 hours', () => {
    expect(IDLE_PROMPT_AFTER_MS).toBe(2 * HOUR);
  });

  it('offers a new game after 2 hours without events', () => {
    vi.useFakeTimers({ now: 0 });
    const log = useEventLogStore();
    log.record('cast', { card: makeCard() });

    expect(shouldOfferNewGame(log, 2 * HOUR - 1)).toBe(false);
    expect(shouldOfferNewGame(log, 2 * HOUR + 1)).toBe(true);
  });

  it('does not offer one with an empty log', () => {
    expect(shouldOfferNewGame(useEventLogStore(), 10 * HOUR)).toBe(false);
  });

  it('does not offer one right after a new game started', () => {
    vi.useFakeTimers({ now: 0 });
    const log = useEventLogStore();
    log.record('cast', { card: makeCard() });
    log.startNewGame('clearSession');

    expect(shouldOfferNewGame(log, 10 * HOUR)).toBe(false);
  });

  it('does not offer it again once dismissed, until there is new activity', () => {
    vi.useFakeTimers({ now: 0 });
    const log = useEventLogStore();
    log.record('cast', { card: makeCard() });

    vi.setSystemTime(3 * HOUR);
    log.dismissNewGameOffer();
    expect(shouldOfferNewGame(log, 4 * HOUR)).toBe(false);

    vi.setSystemTime(4 * HOUR);
    log.record('cast', { card: makeCard() });
    expect(shouldOfferNewGame(log, 6 * HOUR)).toBe(true);
  });
});
