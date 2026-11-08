import { describe, expect, it } from 'vitest';
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

describe('event log archive', () => {
  it('keeps archived games, oldest first, across games', async () => {
    const a = [entry('game-a', 1), entry('game-a', 2)];
    const b = [entry('game-b', 3)];

    expect(await archiveEntries(b)).toBe(true);
    expect(await archiveEntries(a)).toBe(true);

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

  it('reports no archive when IndexedDB is unavailable', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');

    expect(await archiveEntries([entry('game-a', 1)])).toBe(false);
    expect(await loadArchive()).toBeNull();
  });
});
