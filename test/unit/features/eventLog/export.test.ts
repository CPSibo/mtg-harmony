import { describe, expect, it, vi } from 'vitest';
import {
  exportEntries,
  selectForExport,
  useEventLogStore,
  type EventEntry,
} from '~/features/eventLog';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

/**
 * A log over two days and two games: yesterday Old Ooze was fetched and
 * cast; today Bear was fetched and cast, Skipped fetched only, Added added.
 */
function sampleLog() {
  const log = useEventLogStore();
  vi.useFakeTimers({ now: new Date(2026, 10, 6, 20, 0) });
  log.record('fetched', { card: makeScryfallCard({ name: 'Old Ooze' }) });
  log.record('cast', { card: makeCard({ name: 'Old Ooze' }) });
  vi.setSystemTime(new Date(2026, 10, 7, 9, 0));
  log.startNewGame('newGame');
  log.record('fetched', { card: makeScryfallCard({ name: 'Bear' }) });
  log.record('cast', { card: makeCard({ name: 'Bear' }) });
  log.record('fetched', { card: makeScryfallCard({ name: 'Skipped' }) });
  vi.setSystemTime(new Date(2026, 10, 7, 9, 5));
  log.record('added', { card: makeCard({ name: 'Added, "Quoted"' }) });
  log.record('removed', { card: makeCard({ name: 'Bear' }) });
  return log;
}

const names = (entries: EventEntry[]) =>
  entries.map((e) => ('card' in e ? e.card.name : e.type));

describe('selectForExport', () => {
  it('cast lists cards cast or added, oldest first', () => {
    const log = sampleLog();

    const picked = selectForExport(log.history, {
      range: 'all',
      cards: 'cast',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Old Ooze', 'Bear', 'Added, "Quoted"']);
  });

  it('fetched lists every card On-deck showed', () => {
    const log = sampleLog();

    const picked = selectForExport(log.history, {
      range: 'all',
      cards: 'fetched',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Old Ooze', 'Bear', 'Skipped']);
  });

  it('all lists every event in the range', () => {
    const log = sampleLog();

    const picked = selectForExport(log.history, {
      range: 'game',
      cards: 'all',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual([
      'gameMarker',
      'Bear',
      'Bear',
      'Skipped',
      'Added, "Quoted"',
      'Bear',
    ]);
  });

  it('limits to this game', () => {
    const log = sampleLog();

    const picked = selectForExport(log.history, {
      range: 'game',
      cards: 'fetched',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Bear', 'Skipped']);
  });

  it('limits to today', () => {
    const log = sampleLog();
    const gameId = 'some other game';

    const picked = selectForExport(log.history, {
      range: 'today',
      cards: 'cast',
      gameId,
      now: new Date(2026, 10, 7, 23, 0).getTime(),
    });

    expect(names(picked)).toEqual(['Bear', 'Added, "Quoted"']);
  });
});

describe('exportEntries', () => {
  function todayCast() {
    const log = sampleLog();
    return selectForExport(log.history, {
      range: 'game',
      cards: 'cast',
      gameId: log.gameId,
    });
  }

  it('writes a plain list, one line per card', () => {
    const text = exportEntries(todayCast(), 'text');

    expect(text).toBe(
      ['09:00  Cast   Bear', '09:05  Added  Added, "Quoted"', ''].join('\n'),
    );
  });

  it('writes CSV with a header and quoted fields', () => {
    const entries = todayCast();

    const csv = exportEntries(entries, 'csv');

    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe('time,event,card,details,scryfall_url,game');
    expect(lines[1]).toBe(
      `${new Date(2026, 10, 7, 9, 0).toISOString()},cast,Bear,,${'card' in entries[0]! ? entries[0].card.scryfallUri : ''},${entries[0]!.gameId}`,
    );
    expect(lines[2]).toContain(',added,"Added, ""Quoted""",');
  });

  it('writes events without a single card with their details', () => {
    const log = sampleLog();
    log.record('attached', {
      card: makeCard({ name: 'Aura' }),
      target: makeCard({ name: 'Host' }),
    });
    const entries = selectForExport(log.history, {
      range: 'game',
      cards: 'all',
      gameId: log.gameId,
    });

    const text = exportEntries(entries, 'text').split('\n');
    const csv = exportEntries(entries, 'csv').split('\n');

    expect(text[0]).toBe('09:00  New game  from the menu');
    expect(text.at(-2)).toBe('09:05  Attached  Aura to Host');
    expect(csv[1]).toContain(',gameMarker,,from the menu,,');
    expect(csv.at(-2)).toContain(',attached,Aura,Aura to Host,');
  });

  it('writes just the header for nothing', () => {
    expect(exportEntries([], 'csv')).toBe(
      'time,event,card,details,scryfall_url,game\n',
    );
    expect(exportEntries([], 'text')).toBe('');
  });
});
