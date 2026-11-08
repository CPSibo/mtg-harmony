import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushSaves } from '~/composables/useLocalStorage';
import {
  MAX_ENTRIES,
  MAX_AGE_MS,
  snapshotCard,
  useEventLogStore,
  type EventEntry,
} from '~/features/eventLog';
import { setActivePinia, createPinia } from 'pinia';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

/** The logged card's name, for entries that have one. */
function cardName(entry: EventEntry | undefined) {
  return entry && 'card' in entry ? entry.card.name : undefined;
}

describe('event log store', () => {
  it('records an entry with a timestamp, the game and a card snapshot', () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z') });
    const log = useEventLogStore();
    const card = makeCard({ name: 'Ooze' });

    const entry = log.record('cast', { card });

    expect(log.entries).toEqual([entry]);
    expect(entry).toMatchObject({
      type: 'cast',
      at: Date.parse('2026-11-07T12:00:00Z'),
      gameId: log.gameId,
      card: {
        instanceId: card.id,
        scryfallId: card.scryfallInfo.id,
        name: 'Ooze',
        imageUri: card.image_uri,
        scryfallUri: card.scryfall_uri,
      },
    });
    expect(entry.id).toBeTruthy();
  });

  it('snapshots a Scryfall card without an instance ID', () => {
    const scryfall = makeScryfallCard({ name: 'Fetched' });

    expect(snapshotCard(scryfall)).toEqual({
      scryfallId: scryfall.id,
      name: 'Fetched',
      imageUri: scryfall.image_uris!.border_crop,
      scryfallUri: scryfall.scryfall_uri,
    });
  });

  it('keeps a snapshot, not a live card', () => {
    const log = useEventLogStore();
    const card = makeCard({ name: 'Before' });

    log.record('cast', { card });
    card.name = 'After';

    expect(cardName(log.entries[0])).toBe('Before');
  });

  it('records type-specific details', () => {
    const log = useEventLogStore();
    const host = makeCard({ name: 'Host' });

    const entry = log.record('attached', {
      card: makeCard(),
      target: host,
    });

    expect(entry.target).toMatchObject({ instanceId: host.id, name: 'Host' });
  });

  it('starts a new game with a marker', () => {
    const log = useEventLogStore();
    const first = log.gameId;

    const marker = log.startNewGame('clearSession');

    expect(log.gameId).not.toBe(first);
    expect(marker).toMatchObject({
      type: 'gameMarker',
      reason: 'clearSession',
      gameId: log.gameId,
    });
  });

  it('drops entries older than the maximum age', () => {
    vi.useFakeTimers({ now: 0 });
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Old' }) });

    vi.setSystemTime(MAX_AGE_MS + 1);
    log.record('fetched', { card: makeScryfallCard({ name: 'New' }) });

    expect(log.entries.map(cardName)).toEqual(['New']);
  });

  it('keeps at most the maximum number of entries, dropping the oldest', () => {
    const log = useEventLogStore();
    for (let i = 0; i < MAX_ENTRIES + 2; i++) log.record('boardCleared', {});

    expect(log.entries).toHaveLength(MAX_ENTRIES);
  });

  it('survives a reload, game included', async () => {
    const log = useEventLogStore();
    log.startNewGame('clearBoard');
    log.record('cast', { card: makeCard({ name: 'Kept' }) });
    const gameId = log.gameId;
    await nextTick();
    flushSaves();

    setActivePinia(createPinia());
    const reloaded = useEventLogStore();

    expect(reloaded.entries.map((e) => e.type)).toEqual(['gameMarker', 'cast']);
    expect(reloaded.gameId).toBe(gameId);
  });

  it('ignores saved entries that are not entries', () => {
    localStorage.setItem(
      'mtg-harmony_eventLog',
      // devalue's format for a plain object
      '[{"entries":1,"gameId":3},[2],"junk","game-1"]',
    );

    const log = useEventLogStore();

    expect(log.entries).toEqual([]);
    expect(log.gameId).toBe('game-1');
  });

  it('reset empties the log and starts a new game', () => {
    const log = useEventLogStore();
    log.record('boardCleared', {});
    const before = log.gameId;

    log.reset();

    expect(log.entries).toEqual([]);
    expect(log.gameId).not.toBe(before);
  });
});
