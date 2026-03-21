import type { HistoryEntry } from '../types/card'

export type CopyFormat = 'raw' | 'md-unordered' | 'md-ordered' | 'numbered'

/** Returns the display line for a single entry, appending "(Cast)" when applicable. */
function entryLine(entry: HistoryEntry): string {
  return entry.wasCast ? `${entry.cardName} (Cast)` : entry.cardName
}

/**
 * Formats an array of history entries as a plain-text string for clipboard export.
 *
 * - `raw`          — one card per line, no prefix
 * - `md-unordered` — Markdown unordered list (`- Card Name`)
 * - `md-ordered`   — Markdown ordered list, all items use `1.` (lazy CommonMark style)
 * - `numbered`     — numbered list with sequential integers (`1.`, `2.`, `3.`)
 *
 * Returns an empty string when the entries array is empty.
 */
export function formatEntries(entries: HistoryEntry[], format: CopyFormat): string {
  if (!entries.length) return ''
  return entries
    .map((entry, i) => {
      const line = entryLine(entry)
      switch (format) {
        case 'raw':          return line
        case 'md-unordered': return `- ${line}`
        case 'md-ordered':   return `1. ${line}`
        case 'numbered':     return `${i + 1}. ${line}`
      }
    })
    .join('\n')
}
