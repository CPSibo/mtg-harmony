import type { ScryfallCard } from '~/types/Scryfall';
import type {
  EventEntry,
  EventType,
  GameMarkerReason,
  LoggedCard,
} from './types';

/** How each event type reads in the log, with its icon. */
export const EVENT_LABELS: Record<EventType, { label: string; icon: string }> =
  {
    fetched: { label: 'Fetched', icon: 'i-lucide-download' },
    cast: { label: 'Cast', icon: 'i-lucide-sparkles' },
    added: { label: 'Added', icon: 'i-lucide-plus' },
    attached: { label: 'Attached', icon: 'i-lucide-link' },
    putUnder: { label: 'Put under', icon: 'i-lucide-layers' },
    copied: { label: 'Copied', icon: 'i-lucide-copy' },
    removed: { label: 'Removed', icon: 'i-lucide-trash' },
    melded: { label: 'Melded', icon: 'i-lucide-merge' },
    unmelded: { label: 'Unmelded', icon: 'i-lucide-split' },
    tokenCreated: { label: 'Created token', icon: 'i-lucide-circle-plus' },
    boardCleared: { label: 'Board cleared', icon: 'i-lucide-brush-cleaning' },
    gameMarker: { label: 'New game', icon: 'i-lucide-flag' },
  };

const COPY_MODE_LABELS = {
  card: 'card only',
  counters: 'with counters',
  stack: 'everything',
} as const;

const REASON_LABELS: Record<GameMarkerReason, string> = {
  newGame: 'from the menu',
  idlePrompt: 'after a break',
};

export interface EntryFilter {
  /** Event types to keep. Empty or missing keeps every type. */
  types?: readonly EventType[];
  /** Part of a card name, any case. Matches the card, target or source. */
  name?: string;
}

function cardNames(entry: EventEntry): string[] {
  const names: string[] = [];
  if ('card' in entry) names.push(entry.card.name);
  if ('target' in entry) names.push(entry.target.name);
  if ('source' in entry) names.push(entry.source.name);
  return names;
}

/**
 * The first `max` of `newer` followed by `older`, both already newest first,
 * without copying the rest (#173): the log window shows the newest 200 of
 * the current game and past games.
 */
export function takeNewest<T>(
  newer: readonly T[],
  older: readonly T[],
  max: number,
): T[] {
  return newer.length >= max
    ? newer.slice(0, max)
    : [...newer, ...older.slice(0, max - newer.length)];
}

/** The entries that match `filter`, newest first. */
export function filterEntries(
  entries: readonly EventEntry[],
  filter: EntryFilter,
): EventEntry[] {
  const types = filter.types?.length ? new Set(filter.types) : null;
  const name = filter.name?.trim().toLowerCase() ?? '';

  return entries
    .filter(
      (entry) =>
        (!types || types.has(entry.type)) &&
        (!name || cardNames(entry).some((n) => n.toLowerCase().includes(name))),
    )
    .reverse();
}

/** One line saying what happened. */
export function describeEntry(entry: EventEntry): string {
  switch (entry.type) {
    case 'cast':
      return entry.toGraveyard
        ? `Cast ${entry.card.name} to the graveyard`
        : `Cast ${entry.card.name}`;
    case 'fetched':
    case 'added':
    case 'removed':
      return `${EVENT_LABELS[entry.type].label} ${entry.card.name}`;
    case 'attached':
      return `Attached ${entry.card.name} to ${entry.target.name}`;
    case 'putUnder':
      return `Put ${entry.card.name} under ${entry.target.name}`;
    case 'copied':
      return `Copied ${entry.source.name} (${COPY_MODE_LABELS[entry.mode]})`;
    case 'melded':
    case 'unmelded':
      return `${EVENT_LABELS[entry.type].label} ${entryDetails(entry)}`;
    case 'tokenCreated':
      return `Created ${entryDetails(entry)}`;
    case 'boardCleared':
      return 'Cleared the board';
    case 'gameMarker':
      return `New game (${REASON_LABELS[entry.reason]})`;
  }
}

/**
 * What an entry says beyond its label and card, or '' when the label and
 * card name say it all.
 */
export function entryDetails(entry: EventEntry): string {
  switch (entry.type) {
    case 'attached':
      return `${entry.card.name} to ${entry.target.name}`;
    case 'putUnder':
      return `${entry.card.name} under ${entry.target.name}`;
    case 'copied':
      return `${entry.source.name} (${COPY_MODE_LABELS[entry.mode]})`;
    case 'melded':
      return `${entry.source.name} and ${entry.target.name} into ${entry.card.name}`;
    case 'unmelded':
      return `${entry.card.name} into ${entry.source.name} and ${entry.target.name}`;
    case 'tokenCreated':
      return `${entry.card.name} from ${entry.source.name}`;
    case 'gameMarker':
      return REASON_LABELS[entry.reason];
    case 'cast':
      return entry.toGraveyard ? `${entry.card.name} to the graveyard` : '';
    default:
      return '';
  }
}

/**
 * Enough of a Scryfall card to cast a logged card again. The board only reads
 * a card's ID, name, image and Scryfall link.
 */
export function scryfallCardFromSnapshot(card: LoggedCard): ScryfallCard {
  return {
    id: card.scryfallId,
    name: card.name,
    mana_cost: '',
    ...card.text,
    scryfall_uri: card.scryfallUri,
    image_uris: { border_crop: card.imageUri },
  } as ScryfallCard;
}
