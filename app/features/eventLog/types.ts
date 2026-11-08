import type { CopyMode } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';

/** A card as it was when the event happened. Never a live board card. */
export interface LoggedCard {
  /** The board instance. Missing for cards that weren't on the board yet. */
  instanceId?: string;
  scryfallId: string;
  name: string;
  imageUri: string;
  scryfallUri: string;
  /** What a text card shows, for when card images are off. */
  text?: LoggedCardText;
}

/** The parts of a card a text card shows, besides its name. */
export type LoggedCardText = Pick<
  ScryfallCard,
  | 'mana_cost'
  | 'type_line'
  | 'oracle_text'
  | 'power'
  | 'toughness'
  | 'card_faces'
>;

/** Why a new game started. */
export type GameMarkerReason = 'clearBoard' | 'clearSession' | 'idlePrompt';

type AnyCard = BoardCard | ScryfallCard;

/**
 * What each event type records besides the common fields. Card fields are
 * live cards on the way in (`record`) and snapshots in the log.
 */
export interface EventPayloads<C = AnyCard> {
  /** Shown in On-deck (not prefetched). */
  fetched: { card: C };
  /** Cast from On-deck. */
  cast: { card: C };
  /** Added through Add Card. */
  added: { card: C };
  attached: { card: C; target: C };
  putUnder: { card: C; target: C };
  copied: { card: C; source: C; mode: CopyMode };
  removed: { card: C };
  boardCleared: Record<string, never>;
  gameMarker: { reason: GameMarkerReason };
}

export type EventType = keyof EventPayloads;

interface EntryBase<T extends EventType> {
  id: string;
  /** Milliseconds since the epoch. */
  at: number;
  type: T;
  gameId: string;
}

export type EventEntryOf<T extends EventType> = EntryBase<T> &
  EventPayloads<LoggedCard>[T];

/** One log entry. Narrow on `type` for its payload. */
export type EventEntry = { [T in EventType]: EventEntryOf<T> }[EventType];

export const EVENT_TYPES: readonly EventType[] = [
  'fetched',
  'cast',
  'added',
  'attached',
  'putUnder',
  'copied',
  'removed',
  'boardCleared',
  'gameMarker',
];
