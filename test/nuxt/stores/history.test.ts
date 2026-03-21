import { describe, beforeEach, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { HistoryEntry } from '~/types/card'

// ─── Mock persistence ────────────────────────────────────────────────────────

const mockSave = vi.fn()
const mockLoad = vi.fn<() => unknown>(() => null)

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: mockSave, load: mockLoad })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _entryIndex = 0

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const i = ++_entryIndex
  return {
    id: `entry-${i}`,
    cardName: `Card ${i}`,
    scryfall_uri: `https://scryfall.com/card/test-${i}`,
    fetchedAt: new Date().toISOString(),
    wasCast: false,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useHistoryStore', () => {
  let store: ReturnType<typeof useHistoryStore>

  beforeEach(() => {
    _entryIndex = 0
    setActivePinia(createPinia())
    store = useHistoryStore()
    mockLoad.mockReturnValue(null)
    mockSave.mockClear()
  })

  // ─── Initial state ──────────────────────────────────────────────────────

  it('starts with no entries', () => {
    expect(store.entries).toHaveLength(0)
  })

  // ─── addEntry ──────────────────────────────────────────────────────────

  describe('addEntry()', () => {
    it('appends the entry to the list', () => {
      const entry = makeEntry()
      store.addEntry(entry)
      expect(store.entries).toHaveLength(1)
      expect(store.entries[0]).toEqual(entry)
    })

    it('preserves insertion order across multiple calls', () => {
      const a = makeEntry({ cardName: 'Alpha' })
      const b = makeEntry({ cardName: 'Beta' })
      store.addEntry(a)
      store.addEntry(b)
      expect(store.entries[0]!.cardName).toBe('Alpha')
      expect(store.entries[1]!.cardName).toBe('Beta')
    })

    it('stores the wasCast flag as provided', () => {
      store.addEntry(makeEntry({ wasCast: true }))
      expect(store.entries[0]!.wasCast).toBe(true)
    })
  })

  // ─── markCast ──────────────────────────────────────────────────────────

  describe('markCast()', () => {
    it('sets wasCast to true for the matching ID', () => {
      const entry = makeEntry({ wasCast: false })
      store.addEntry(entry)
      store.markCast(entry.id)
      expect(store.entries[0]!.wasCast).toBe(true)
    })

    it('is a no-op for an unknown ID', () => {
      const entry = makeEntry({ wasCast: false })
      store.addEntry(entry)
      store.markCast('non-existent')
      expect(store.entries[0]!.wasCast).toBe(false)
    })

    it('only affects the matched entry when multiple entries exist', () => {
      const a = makeEntry()
      const b = makeEntry()
      store.addEntry(a)
      store.addEntry(b)
      store.markCast(a.id)
      expect(store.entries[0]!.wasCast).toBe(true)
      expect(store.entries[1]!.wasCast).toBe(false)
    })

    it('is idempotent — calling it twice leaves wasCast true', () => {
      const entry = makeEntry()
      store.addEntry(entry)
      store.markCast(entry.id)
      store.markCast(entry.id)
      expect(store.entries[0]!.wasCast).toBe(true)
    })
  })

  // ─── clearAll ──────────────────────────────────────────────────────────

  describe('clearAll()', () => {
    it('empties the entries array', () => {
      store.addEntry(makeEntry())
      store.addEntry(makeEntry())
      store.clearAll()
      expect(store.entries).toHaveLength(0)
    })

    it('is a no-op on an already-empty store', () => {
      store.clearAll()
      expect(store.entries).toHaveLength(0)
    })
  })

  // ─── load() ─────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns false when there is no saved data', () => {
      mockLoad.mockReturnValue(null)
      expect(store.load()).toBe(false)
      expect(store.entries).toHaveLength(0)
    })

    it('returns false when the saved data is not an array', () => {
      mockLoad.mockReturnValue({ entries: [] }) // object, not array
      expect(store.load()).toBe(false)
    })

    it('returns true and hydrates entries from persisted data', () => {
      const saved = [makeEntry(), makeEntry()]
      mockLoad.mockReturnValue(saved)
      expect(store.load()).toBe(true)
      expect(store.entries).toHaveLength(2)
      expect(store.entries[0]!.id).toBe(saved[0]!.id)
    })

    it('preserves wasCast values from persisted data', () => {
      const castEntry = makeEntry({ wasCast: true })
      mockLoad.mockReturnValue([castEntry])
      store.load()
      expect(store.entries[0]!.wasCast).toBe(true)
    })
  })
})
