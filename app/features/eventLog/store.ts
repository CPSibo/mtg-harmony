import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useLocalStorage } from '~/composables/useLocalStorage';
import { randomUUID } from '~/utils/randomUUID';
import { snapshotCard } from './snapshot';
import {
  EVENT_TYPES,
  type EventEntry,
  type EventEntryOf,
  type EventPayloads,
  type EventType,
  type GameMarkerReason,
} from './types';

const STORAGE_KEY = 'mtg-harmony_eventLog';

/** Entries older than this are dropped. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** At most this many entries are kept; the oldest go first. */
export const MAX_ENTRIES = 5000;

const CARD_FIELDS = ['card', 'target', 'source'] as const;

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
 * The event log: one list of meaningful changes (fetches, casts, attaches,
 * copies, removals, game markers), newest last. Moving, tapping and counters
 * aren't logged. Saved to localStorage and trimmed by age and count. A
 * refresh never ends a game; only `startNewGame` does.
 */
export const useEventLogStore = defineStore('eventLog', () => {
  const entries = ref<EventEntry[]>([]);
  const gameId = ref(randomUUID());

  function trim(now = Date.now()) {
    const cutoff = now - MAX_AGE_MS;
    let start = entries.value.findIndex((e) => e.at >= cutoff);
    if (start === -1) start = entries.value.length;
    start = Math.max(start, entries.value.length - MAX_ENTRIES);
    if (start > 0) entries.value.splice(0, start);
  }

  /** Adds an entry for the current game and returns it. */
  function record<T extends EventType>(
    type: T,
    payload: EventPayloads[T],
  ): EventEntryOf<T> {
    const logged: Record<string, unknown> = { ...payload };
    for (const field of CARD_FIELDS) {
      const card = (payload as Record<string, unknown>)[field];
      if (card) logged[field] = snapshotCard(card as never);
    }

    const entry = {
      ...logged,
      id: randomUUID(),
      at: Date.now(),
      type,
      gameId: gameId.value,
    } as EventEntryOf<T>;

    entries.value.push(entry as EventEntry);
    trim(entry.at);
    return entry;
  }

  /** Starts a new game, recording a marker as its first entry. */
  function startNewGame(reason: GameMarkerReason) {
    gameId.value = randomUUID();
    return record('gameMarker', { reason });
  }

  function reset() {
    entries.value = [];
    gameId.value = randomUUID();
  }

  function save() {
    useLocalStorage().save(STORAGE_KEY, {
      entries: entries.value,
      gameId: gameId.value,
    });
  }

  function load(): boolean {
    const data = useLocalStorage().load<{
      entries?: unknown;
      gameId?: unknown;
    }>(STORAGE_KEY);
    if (!data) return false;

    if (Array.isArray(data.entries))
      entries.value = data.entries.filter(isEntry);
    if (typeof data.gameId === 'string') gameId.value = data.gameId;
    trim();
    return true;
  }

  load();
  watch([entries, gameId], save, { deep: true });

  return { entries, gameId, record, startNewGame, reset, save, load };
});
