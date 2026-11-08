import { describe, expect, it, vi } from 'vitest';
import {
  exportEntries,
  selectForExport,
  useEventLogStore,
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
  log.startNewGame('clearSession');
  log.record('fetched', { card: makeScryfallCard({ name: 'Bear' }) });
  log.record('cast', { card: makeCard({ name: 'Bear' }) });
  log.record('fetched', { card: makeScryfallCard({ name: 'Skipped' }) });
  vi.setSystemTime(new Date(2026, 10, 7, 9, 5));
  log.record('added', { card: makeCard({ name: 'Added, "Quoted"' }) });
  log.record('removed', { card: makeCard({ name: 'Bear' }) });
  return log;
}

const names = (entries: { card: { name: string } }[]) =>
  entries.map((e) => e.card.name);

describe('selectForExport', () => {
  it('cast lists cards cast or added, oldest first', () => {
    const log = sampleLog();

    const picked = selectForExport(log.entries, {
      range: 'all',
      cards: 'cast',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Old Ooze', 'Bear', 'Added, "Quoted"']);
  });

  it('fetched lists every card On-deck showed', () => {
    const log = sampleLog();

    const picked = selectForExport(log.entries, {
      range: 'all',
      cards: 'fetched',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Old Ooze', 'Bear', 'Skipped']);
  });

  it('limits to this game', () => {
    const log = sampleLog();

    const picked = selectForExport(log.entries, {
      range: 'game',
      cards: 'fetched',
      gameId: log.gameId,
    });

    expect(names(picked)).toEqual(['Bear', 'Skipped']);
  });

  it('limits to today', () => {
    const log = sampleLog();
    const gameId = 'some other game';

    const picked = selectForExport(log.entries, {
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
    return selectForExport(log.entries, {
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
    expect(lines[0]).toBe('time,event,card,scryfall_url,game');
    expect(lines[1]).toBe(
      `${new Date(2026, 10, 7, 9, 0).toISOString()},cast,Bear,${entries[0]!.card.scryfallUri},${entries[0]!.gameId}`,
    );
    expect(lines[2]).toContain(',added,"Added, ""Quoted""",');
  });

  it('writes just the header for nothing', () => {
    expect(exportEntries([], 'csv')).toBe(
      'time,event,card,scryfall_url,game\n',
    );
    expect(exportEntries([], 'text')).toBe('');
  });
});
