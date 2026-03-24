import { describe, it, expect } from 'vitest'
import type { HistoryEntry } from '../../app/types/HistoryEntry'
import { formatEntries } from '../../app/utils/historyExport'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _index = 0

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const i = ++_index
  return {
    id: `entry-${i}`,
    cardName: `Card ${i}`,
    scryfall_uri: `https://scryfall.com/card/test-${i}`,
    fetchedAt: new Date().toISOString(),
    wasCast: false,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('formatEntries', () => {
  // ─── Empty input ───────────────────────────────────────────────────────────

  it('returns an empty string when entries is empty', () => {
    expect(formatEntries([], 'raw')).toBe('')
    expect(formatEntries([], 'md-unordered')).toBe('')
    expect(formatEntries([], 'md-ordered')).toBe('')
    expect(formatEntries([], 'numbered')).toBe('')
  })

  // ─── Cast annotation ──────────────────────────────────────────────────────

  it('appends " (Cast)" to entries where wasCast is true', () => {
    const entries = [
      makeEntry({ cardName: 'Lightning Bolt', wasCast: true }),
      makeEntry({ cardName: 'Black Lotus', wasCast: false }),
    ]
    const result = formatEntries(entries, 'raw')
    expect(result).toBe('Lightning Bolt (Cast)\nBlack Lotus')
  })

  it('does not append anything to entries where wasCast is false', () => {
    const entries = [makeEntry({ cardName: 'Shock', wasCast: false })]
    expect(formatEntries(entries, 'raw')).toBe('Shock')
  })

  // ─── raw ──────────────────────────────────────────────────────────────────

  describe('raw', () => {
    it('outputs one card name per line with no prefix', () => {
      const entries = [
        makeEntry({ cardName: 'Counterspell' }),
        makeEntry({ cardName: 'Force of Will' }),
      ]
      expect(formatEntries(entries, 'raw')).toBe('Counterspell\nForce of Will')
    })
  })

  // ─── md-unordered ─────────────────────────────────────────────────────────

  describe('md-unordered', () => {
    it('prefixes each line with "- "', () => {
      const entries = [
        makeEntry({ cardName: 'Brainstorm' }),
        makeEntry({ cardName: 'Ponder' }),
      ]
      expect(formatEntries(entries, 'md-unordered')).toBe('- Brainstorm\n- Ponder')
    })

    it('includes the cast annotation after the card name', () => {
      const entry = makeEntry({ cardName: 'Mox Pearl', wasCast: true })
      expect(formatEntries([entry], 'md-unordered')).toBe('- Mox Pearl (Cast)')
    })
  })

  // ─── md-ordered ───────────────────────────────────────────────────────────

  describe('md-ordered', () => {
    it('prefixes every line with "1. " (lazy CommonMark ordered list)', () => {
      const entries = [
        makeEntry({ cardName: 'Ancestral Recall' }),
        makeEntry({ cardName: 'Time Walk' }),
        makeEntry({ cardName: 'Timetwister' }),
      ]
      expect(formatEntries(entries, 'md-ordered')).toBe(
        '1. Ancestral Recall\n1. Time Walk\n1. Timetwister',
      )
    })
  })

  // ─── numbered ─────────────────────────────────────────────────────────────

  describe('numbered', () => {
    it('prefixes lines with sequential integers starting at 1', () => {
      const entries = [
        makeEntry({ cardName: 'Sol Ring' }),
        makeEntry({ cardName: 'Mana Crypt' }),
        makeEntry({ cardName: 'Mana Vault' }),
      ]
      expect(formatEntries(entries, 'numbered')).toBe(
        '1. Sol Ring\n2. Mana Crypt\n3. Mana Vault',
      )
    })

    it('uses "1." for a single entry', () => {
      const entry = makeEntry({ cardName: 'Dark Ritual' })
      expect(formatEntries([entry], 'numbered')).toBe('1. Dark Ritual')
    })
  })
})
