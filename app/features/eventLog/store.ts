import { defineStore } from 'pinia';
import { computed, ref, shallowRef, triggerRef, watch } from 'vue';
import { useLocalStorage } from '~/composables/useLocalStorage';
import { randomUUID } from '~/utils/randomUUID';
import { archiveEntries, clearArchive, loadArchive } from './archive';
import { snapshotCard } from './snapshot';
import {
  EVENT_TYPES,
  type EventEntry,
  type EventEntryOf,
  type EventPayloads,
  type EventType,
  type GameMarkerReason,
  type LoggedCard,
} from './types';

const STORAGE_KEY = 'mtg-harmony_eventLog';

/**
 * The most entries the current game keeps. A realistic long game (six
 * players over two sittings) logs about 1,000.
 */
export const MAX_ENTRIES = 2000;
/** From here the idle prompt warns that the log is filling up. */
export const NEARLY_FULL_ENTRIES = 1000;
/**
 * When the current game fills, it keeps whichever is smaller: the last day,
 * or the newest this many entries. Someone who never starts a new game
 * doesn't need its history.
 */
const KEEP_WHEN_FULL = 250;
const KEEP_WHEN_FULL_MS = 24 * 60 * 60 * 1000;

const CARD_FIELDS = ['card', 'target', 'source'] as const;

/** One key per board instance, or per Scryfall card for unplaced cards. */
function cardKey(card: LoggedCard) {
  return card.instanceId ?? `scryfall:${card.scryfallId}`;
}

function isEntry(value: unknown): value is EventEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<EventEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'number' &&
    typeof entry.gameId === 'string' &&
    EVENT_TYPES.includes(entry.type as EventType)
  );
}

/**
 * The event log: meaningful changes (fetches, casts, attaches, copies,
 * removals, game markers), newest last. Moving, tapping and counters aren't
 * logged. A refresh never ends a game; only `startNewGame` does.
 *
 * Split in two (#81): `entries` is the current game, kept in localStorage
 * and read synchronously by anything in play. Finished games move to an
 * IndexedDB archive, which only the log window and export read, through
 * `loadHistory()` and `history`. Without IndexedDB the log is the current
 * game only.
 */
export const useEventLogStore = defineStore('eventLog', () => {
  // Shallow: entries never change once recorded, and making thousands of them
  // deeply reactive cost tens of milliseconds per event (#81). Changes to the
  // list call `changed()`.
  const entries = shallowRef<EventEntry[]>([]);
  function changed() {
    triggerRef(entries);
  }
  const gameId = ref(randomUUID());

  /**
   * Finished games not yet in the archive. Saved with the current game, so a
   * tab closed mid-write archives them on the next start.
   */
  const pending = shallowRef<EventEntry[]>([]);
  /** The archive once loaded by `loadHistory()`, else null. */
  const archived = shallowRef<EventEntry[] | null>(null);
  /** Whether IndexedDB works here; null until first used. */
  const archiveAvailable = ref<boolean | null>(null);

  /** Archive work, one task at a time and in order. */
  let queue: Promise<void> = Promise.resolve();
  function enqueue(task: () => Promise<void>) {
    queue = queue.then(task, task);
    return queue;
  }
  /** Resolves when archive work queued so far has finished. */
  function settled() {
    return queue;
  }

  function archivePending() {
    return enqueue(async () => {
      const batch = pending.value;
      if (!batch.length) return;
      const ok = await archiveEntries(batch);
      archiveAvailable.value = ok;
      // Archived, or nowhere to put it: either way it leaves localStorage.
      const done = new Set(batch);
      pending.value = pending.value.filter((e) => !done.has(e));
      if (ok && archived.value) archived.value = [...archived.value, ...batch];
    });
  }

  /** Loads the archive into `history`. */
  function loadHistory() {
    return enqueue(async () => {
      const loaded = await loadArchive();
      archiveAvailable.value = loaded !== null;
      archived.value = loaded ?? [];
    });
  }

  /** Every entry the log has, oldest first: after `loadHistory()`, past games too. */
  const history = computed(() => [
    ...(archived.value ?? []),
    ...pending.value,
    ...entries.value,
  ]);

  /** Empties the archive. The current game stays. */
  function clearHistory() {
    pending.value = [];
    if (archived.value) archived.value = [];
    void enqueue(clearArchive);
  }

  const nearlyFull = computed(
    () => entries.value.length >= NEARLY_FULL_ENTRIES,
  );

  /** When the idle new-game offer was last dismissed (ms), or null. */
  const newGameOfferDismissedAt = ref<number | null>(null);
  function dismissNewGameOffer() {
    newGameOfferDismissedAt.value = Date.now();
  }

  const windowIsOpen = ref(false);
  function openWindow() {
    windowIsOpen.value = true;
  }
  function closeWindow() {
    windowIsOpen.value = false;
  }

  // Every entry about the same card points at one snapshot object, so the
  // saved log (devalue keeps shared references) stores each card once.
  const snapshots = new Map<string, LoggedCard>();

  function sharedSnapshot(card: Parameters<typeof snapshotCard>[0]) {
    const fresh = snapshotCard(card);
    const key = cardKey(fresh);
    const known = snapshots.get(key);
    if (known) return known;
    snapshots.set(key, fresh);
    return fresh;
  }

  /** Rebuilds the snapshot index from the entries left after a load or trim. */
  function reindexSnapshots() {
    snapshots.clear();
    for (const entry of entries.value) {
      for (const field of CARD_FIELDS) {
        const card = (entry as Record<string, unknown>)[field] as
          LoggedCard | undefined;
        if (card) snapshots.set(cardKey(card), card);
      }
    }
  }

  /**
   * When the current game is over the cap, drops whichever is more: entries
   * over a day old, or all but the newest 250. Returns whether it dropped any.
   */
  function trim(now = Date.now()): boolean {
    const list = entries.value;
    if (list.length <= MAX_ENTRIES) return false;
    let old = list.findIndex((e) => e.at >= now - KEEP_WHEN_FULL_MS);
    if (old === -1) old = list.length;
    list.splice(0, Math.max(old, list.length - KEEP_WHEN_FULL));
    reindexSnapshots();
    changed();
    return true;
  }

  /** Adds an entry for the current game and returns it. */
  function record<T extends EventType>(
    type: T,
    payload: EventPayloads[T],
  ): EventEntryOf<T> {
    const logged: Record<string, unknown> = { ...payload };
    for (const field of CARD_FIELDS) {
      const card = (payload as Record<string, unknown>)[field];
      if (card) logged[field] = sharedSnapshot(card as never);
    }

    const entry = {
      ...logged,
      id: randomUUID(),
      at: Date.now(),
      type,
      gameId: gameId.value,
    } as EventEntryOf<T>;

    entries.value.push(entry as EventEntry);
    changed();
    trim(entry.at);
    return entry;
  }

  /**
   * Starts a new game, recording a marker as its first entry. Everything
   * before it moves to the archive.
   */
  function startNewGame(reason: GameMarkerReason) {
    pending.value = [...pending.value, ...entries.value];
    entries.value = [];
    snapshots.clear();
    gameId.value = randomUUID();
    const marker = record('gameMarker', { reason });
    void archivePending();
    return marker;
  }

  /** Empties the log, archive included. */
  function reset() {
    entries.value = [];
    clearHistory();
    newGameOfferDismissedAt.value = null;
    snapshots.clear();
    gameId.value = randomUUID();
  }

  function save() {
    useLocalStorage().save(STORAGE_KEY, {
      entries: entries.value,
      pending: pending.value,
      gameId: gameId.value,
      newGameOfferDismissedAt: newGameOfferDismissedAt.value,
    });
  }

  function load(): boolean {
    const data = useLocalStorage().load<{
      entries?: unknown;
      pending?: unknown;
      gameId?: unknown;
      newGameOfferDismissedAt?: unknown;
    }>(STORAGE_KEY);
    if (!data) return false;

    if (Array.isArray(data.entries))
      entries.value = data.entries.filter(isEntry);
    if (Array.isArray(data.pending))
      pending.value = data.pending.filter(isEntry);
    if (typeof data.gameId === 'string') gameId.value = data.gameId;
    if (typeof data.newGameOfferDismissedAt === 'number')
      newGameOfferDismissedAt.value = data.newGameOfferDismissedAt;
    reindexSnapshots();
    if (trim()) save();
    return true;
  }

  load();
  watch([entries, pending, gameId, newGameOfferDismissedAt], save);
  if (pending.value.length) void archivePending();

  return {
    entries,
    gameId,
    record,
    startNewGame,
    reset,
    nearlyFull,
    history,
    loadHistory,
    clearHistory,
    archiveAvailable,
    settled,
    save,
    load,
    newGameOfferDismissedAt,
    dismissNewGameOffer,
    windowIsOpen,
    openWindow,
    closeWindow,
  };
});
