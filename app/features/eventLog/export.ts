import type { EventEntryOf } from './types';
import { EVENT_LABELS } from './view';

/** Which part of the log to export. */
export type ExportRange = 'game' | 'today' | 'all';
/** `cast`: cards cast or added to the board. `fetched`: every card shown. */
export type ExportCards = 'cast' | 'fetched';
export type ExportFormat = 'text' | 'csv';

export type ExportedEntry = EventEntryOf<'cast' | 'added' | 'fetched'>;

export interface ExportOptions {
  range: ExportRange;
  cards: ExportCards;
  /** The current game, for `range: 'game'`. */
  gameId: string;
  now?: number;
}

const TYPES: Record<ExportCards, readonly string[]> = {
  cast: ['cast', 'added'],
  fetched: ['fetched'],
};

function startOfDay(at: number) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The card entries to export, oldest first. */
export function selectForExport(
  entries: readonly { type: string; at: number; gameId: string }[],
  { range, cards, gameId, now = Date.now() }: ExportOptions,
): ExportedEntry[] {
  const since = range === 'today' ? startOfDay(now) : -Infinity;
  return entries.filter(
    (e) =>
      TYPES[cards].includes(e.type) &&
      e.at >= since &&
      (range !== 'game' || e.gameId === gameId),
  ) as ExportedEntry[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function toText(entries: readonly ExportedEntry[]) {
  const dates = entries.map((e) => new Date(e.at));
  const manyDays = new Set(dates.map(day)).size > 1;
  const labels = entries.map((e) => EVENT_LABELS[e.type].label);
  const width = Math.max(0, ...labels.map((l) => l.length)) + 2;

  return entries
    .map((e, i) => {
      const d = dates[i]!;
      const when = manyDays ? `${day(d)} ${time(d)}` : time(d);
      return `${when}  ${labels[i]!.padEnd(width)}${e.card.name}\n`;
    })
    .join('');
}

/** Quotes a CSV field when it holds a comma, quote or line break. */
function csvField(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toCsv(entries: readonly ExportedEntry[]) {
  const rows = entries.map((e) =>
    [
      new Date(e.at).toISOString(),
      e.type,
      e.card.name,
      e.card.scryfallUri,
      e.gameId,
    ]
      .map(csvField)
      .join(','),
  );
  return ['time,event,card,scryfall_url,game', ...rows].join('\n') + '\n';
}

/** The entries as a plain list (local times) or CSV (UTC ISO times). */
export function exportEntries(
  entries: readonly ExportedEntry[],
  format: ExportFormat,
): string {
  return format === 'csv' ? toCsv(entries) : toText(entries);
}
