import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EventEntry } from './types';

/**
 * Finished games, in IndexedDB (#81). The event log store keeps only the
 * current game in localStorage; New game moves the rest here. Each game is
 * one record, so a card mentioned by many of its entries is stored once
 * (IndexedDB keeps shared references within a record).
 */

/** Archived games older than this are dropped. */
export const ARCHIVE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** At most this many archived entries are kept; the oldest games go first. */
export const ARCHIVE_MAX_ENTRIES = 500_000;

const DB_NAME = 'mtg-harmony';

interface GameSummary {
  gameId: string;
  /** When the game's last entry happened. */
  end: number;
  count: number;
}

interface ArchiveSchema extends DBSchema {
  /** What retention needs, without reading any entries. */
  games: { key: string; value: GameSummary; indexes: { end: number } };
  gameEntries: {
    key: string;
    value: { gameId: string; entries: EventEntry[] };
  };
}

async function open(): Promise<IDBPDatabase<ArchiveSchema> | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    return await openDB<ArchiveSchema>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('games', { keyPath: 'gameId' }).createIndex(
          'end',
          'end',
        );
        db.createObjectStore('gameEntries', { keyPath: 'gameId' });
      },
    });
  } catch (ex) {
    // Private windows in some browsers, or storage blocked.
    console.error('Could not open the event log archive.', ex);
    return null;
  }
}

/**
 * Adds `entries` to the archive, one record per game, then drops games past
 * the age and entry limits. Archiving a game again replaces it. Resolves
 * whether it worked; false when IndexedDB is unavailable or the write failed.
 */
export async function archiveEntries(
  entries: readonly EventEntry[],
  maxEntries = ARCHIVE_MAX_ENTRIES,
): Promise<boolean> {
  if (!entries.length) return true;
  const db = await open();
  if (!db) return false;

  const byGame = new Map<string, EventEntry[]>();
  for (const entry of entries) {
    const game = byGame.get(entry.gameId) ?? [];
    game.push(entry);
    byGame.set(entry.gameId, game);
  }

  try {
    const tx = db.transaction(['games', 'gameEntries'], 'readwrite');
    const games = tx.objectStore('games');
    for (const [gameId, game] of byGame) {
      void games.put({ gameId, end: game.at(-1)!.at, count: game.length });
      void tx.objectStore('gameEntries').put({ gameId, entries: game });
    }

    // Retention: oldest games first, while too old or over the cap.
    const summaries = await games.index('end').getAll();
    let total = summaries.reduce((sum, g) => sum + g.count, 0);
    const cutoff = Date.now() - ARCHIVE_MAX_AGE_MS;
    for (const game of summaries) {
      if (game.end >= cutoff && total <= maxEntries) break;
      void games.delete(game.gameId);
      void tx.objectStore('gameEntries').delete(game.gameId);
      total -= game.count;
    }
    await tx.done;
    return true;
  } catch (ex) {
    // Storage full, or the browser refused.
    console.error('Could not archive event log entries.', ex);
    return false;
  } finally {
    db.close();
  }
}

/** Every archived entry, oldest first, or null when there's no archive. */
export async function loadArchive(): Promise<EventEntry[] | null> {
  const db = await open();
  if (!db) return null;
  try {
    const tx = db.transaction(['games', 'gameEntries'], 'readonly');
    const order = await tx.objectStore('games').index('end').getAllKeys();
    const games = await Promise.all(
      order.map((gameId) => tx.objectStore('gameEntries').get(gameId)),
    );
    return games.flatMap((game) => game?.entries ?? []);
  } catch (ex) {
    console.error('Could not load the event log archive.', ex);
    return null;
  } finally {
    db.close();
  }
}

/** Empties the archive. */
export async function clearArchive(): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(['games', 'gameEntries'], 'readwrite');
    void tx.objectStore('games').clear();
    void tx.objectStore('gameEntries').clear();
    await tx.done;
  } catch (ex) {
    console.error('Could not clear the event log archive.', ex);
  } finally {
    db.close();
  }
}
