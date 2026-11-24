import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';
import {
  ARCHIVE_MAX_AGE_MS,
  archiveEntries,
  clearArchive,
  loadArchive,
} from '~/features/eventLog/archive';
import type { EventEntry, LoggedCard } from '~/features/eventLog';

const card: LoggedCard = {
  scryfallId: 'scryfall-1',
  name: 'Ooze',
  imageUri: 'https://img.example/1.jpg',
  scryfallUri: 'https://scryfall.com/card/1',
};

let next = 0;
const T = Date.now();
/** An entry `at` ms after the test file loaded (negative for before). */
function entry(gameId: string, at: number, c = card): EventEntry {
  return {
    id: `entry-${++next}`,
    at: T + at,
    gameId,
    type: 'fetched',
    card: c,
  };
}

/** Makes IndexedDB refuse every write, as when storage is full. */
function failWrites() {
  const transaction = IDBDatabase.prototype.transaction;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return vi
    .spyOn(IDBDatabase.prototype, 'transaction')
    .mockImplementation(function (this: IDBDatabase, ...args) {
      if (args[1] === 'readwrite')
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return transaction.apply(this, args);
    });
}

describe('event log archive', () => {
  it('keeps archived games, oldest first, across games', async () => {
    const a = [entry('game-a', 1), entry('game-a', 2)];
    const b = [entry('game-b', 3)];

    expect(await archiveEntries(b)).toBe('archived');
    expect(await archiveEntries(a)).toBe('archived');

    expect((await loadArchive())?.map((e) => e.id)).toEqual(
      [...a, ...b].map((e) => e.id),
    );
  });

  it('stores each card once per game, so entries still share it', async () => {
    await archiveEntries([entry('game-a', 1), entry('game-a', 2)]);

    const [first, second] = (await loadArchive())!;
    expect(first && 'card' in first && first.card).toBe(
      second && 'card' in second && second.card,
    );
  });

  it('archiving the same game again replaces it, so a retry is harmless', async () => {
    const game = [entry('game-a', 1), entry('game-a', 2)];

    await archiveEntries(game);
    await archiveEntries(game);

    expect(await loadArchive()).toHaveLength(2);
  });

  it('drops games older than a year', async () => {
    await archiveEntries([entry('old', -ARCHIVE_MAX_AGE_MS - 1000)]);
    await archiveEntries([entry('new', 0)]);

    expect((await loadArchive())?.map((e) => e.gameId)).toEqual(['new']);
  });

  it('drops the oldest games past the entry cap', async () => {
    await archiveEntries([entry('first', -2), entry('first', -2)], 3);
    await archiveEntries([entry('second', -1)], 3);
    await archiveEntries([entry('third', 0)], 3);

    expect((await loadArchive())?.map((e) => e.gameId)).toEqual([
      'second',
      'third',
    ]);
  });

  it('clears', async () => {
    await archiveEntries([entry('game-a', 1)]);

    await clearArchive();

    expect(await loadArchive()).toEqual([]);
  });

  // #154: records carry a version, so a later shape change knows them.
  it('skips archived games of another version', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await archiveEntries([entry('current', 1)]);
    const db = await openDB('mtg-harmony', 1);
    await db.put('games', { gameId: 'future', end: T, count: 1 });
    await db.put('gameEntries', {
      gameId: 'future',
      version: 99,
      entries: [entry('future', 2)],
    });
    db.close();

    const loaded = await loadArchive();

    expect(loaded!.map((e) => e.gameId)).toEqual(['current']);
  });

  it('reports no archive when IndexedDB is unavailable', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');

    expect(await archiveEntries([entry('game-a', 1)])).toBe('unavailable');
    expect(await loadArchive()).toBeNull();
  });

  // #156: a failed write and no IndexedDB were both `false`.
  it('tells a failed write apart from no IndexedDB', async () => {
    failWrites();

    expect(await archiveEntries([entry('game-a', 1)])).toBe('failed');
  });
});
