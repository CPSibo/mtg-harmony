import type { EventEntry } from './types';
import { entryDetails, EVENT_LABELS } from './view';

/** Which part of the log to export. */
export type ExportRange = 'game' | 'today' | 'all';
/**
 * `cast`: cards cast or added to the board. `fetched`: every card shown.
 * `all`: every event.
 */
export type ExportCards = 'cast' | 'fetched' | 'all';
export type ExportFormat = 'text' | 'csv';

export interface ExportOptions {
  range: ExportRange;
  cards: ExportCards;
  /** The current game, for `range: 'game'`. */
  gameId: string;
  now?: number;
}

const TYPES: Record<Exclude<ExportCards, 'all'>, readonly string[]> = {
  cast: ['cast', 'added'],
  fetched: ['fetched'],
};

function startOfDay(at: number) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The entries to export, oldest first. */
export function selectForExport(
  entries: readonly EventEntry[],
  { range, cards, gameId, now = Date.now() }: ExportOptions,
): EventEntry[] {
  const since = range === 'today' ? startOfDay(now) : -Infinity;
  return entries.filter(
    (e) =>
      (cards === 'all' || TYPES[cards].includes(e.type)) &&
      e.at >= since &&
      (range !== 'game' || e.gameId === gameId),
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function toText(entries: readonly EventEntry[]) {
  const dates = entries.map((e) => new Date(e.at));
  const manyDays = new Set(dates.map(day)).size > 1;
  const labels = entries.map((e) => EVENT_LABELS[e.type].label);
  const width = Math.max(0, ...labels.map((l) => l.length)) + 2;

  return entries
    .map((e, i) => {
      const d = dates[i]!;
      const when = manyDays ? `${day(d)} ${time(d)}` : time(d);
      const what = entryDetails(e) || ('card' in e ? e.card.name : '');
      return `${when}  ${labels[i]!.padEnd(width)}${what}`.trimEnd() + '\n';
    })
    .join('');
}

/** Quotes a CSV field when it holds a comma, quote or line break. */
function csvField(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toCsv(entries: readonly EventEntry[]) {
  const rows = entries.map((e) => {
    const card = 'card' in e ? e.card : undefined;
    return [
      new Date(e.at).toISOString(),
      e.type,
      card?.name ?? '',
      entryDetails(e),
      card?.scryfallUri ?? '',
      e.gameId,
    ]
      .map(csvField)
      .join(',');
  });
  return (
    ['time,event,card,details,scryfall_url,game', ...rows].join('\n') + '\n'
  );
}

/** The entries as a plain list (local times) or CSV (UTC ISO times). */
export function exportEntries(
  entries: readonly EventEntry[],
  format: ExportFormat,
): string {
  return format === 'csv' ? toCsv(entries) : toText(entries);
}
