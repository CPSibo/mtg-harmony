import { describe, beforeEach, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { ScryfallCard, HistoryEntry } from '~/types/card'

// ─── Mock persistence ────────────────────────────────────────────────────────

const mockSave = vi.fn()
const mockLoad = vi.fn<() => unknown>(() => null)

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: mockSave, load: mockLoad })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeScryfallCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: 'scryfall-abc123',
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    scryfall_uri: 'https://scryfall.com/card/lea/161/lightning-bolt',
    image_uris: { normal: 'https://cards.scryfall.io/normal/front/lightning-bolt.jpg' },
    ...overrides,
  }
}

function makeHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    cardName: 'Lightning Bolt',
    scryfall_uri: 'https://scryfall.com/card/lea/161/lightning-bolt',
    fetchedAt: new Date().toISOString(),
    wasCast: false,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useOnDeckStore', () => {
  let store: ReturnType<typeof useOnDeckStore>
  let gridStore: ReturnType<typeof useGridStore>
  let historyStore: ReturnType<typeof useHistoryStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useOnDeckStore()
    gridStore = useGridStore()
    historyStore = useHistoryStore()
    mockLoad.mockReturnValue(null)
    mockSave.mockClear()
  })

  // ─── Initial state ──────────────────────────────────────────────────────

  it('starts with no card on deck', () => {
    expect(store.card).toBeNull()
  })

  // ─── setCard ───────────────────────────────────────────────────────────

  describe('setCard()', () => {
    it('converts a ScryfallCard into a GridCard and stores it on deck', () => {
      const scryfall = makeScryfallCard()
      store.setCard(scryfall)
      expect(store.card).not.toBeNull()
      expect(store.card!.id).toBe(scryfall.id)
      expect(store.card!.name).toBe(scryfall.name)
      expect(store.card!.mana_cost).toBe(scryfall.mana_cost)
      expect(store.card!.image_uri).toBe(scryfall.image_uris.normal)
      expect(store.card!.scryfall_uri).toBe(scryfall.scryfall_uri)
    })

    it('initialises instanceCount to 1 and modifiers to []', () => {
      store.setCard(makeScryfallCard())
      expect(store.card!.instanceCount).toBe(1)
      expect(store.card!.modifiers).toHaveLength(0)
    })

    it('overwrites the previous on-deck card', () => {
      store.setCard(makeScryfallCard({ name: 'First' }))
      store.setCard(makeScryfallCard({ name: 'Second' }))
      expect(store.card!.name).toBe('Second')
    })
  })

  // ─── clearCard ─────────────────────────────────────────────────────────

  describe('clearCard()', () => {
    it('sets the on-deck card to null', () => {
      store.setCard(makeScryfallCard())
      store.clearCard()
      expect(store.card).toBeNull()
    })

    it('is a no-op when there is already no card on deck', () => {
      store.clearCard()
      expect(store.card).toBeNull()
    })
  })

  // ─── castCard ──────────────────────────────────────────────────────────

  describe('castCard()', () => {
    it('is a no-op when there is no card on deck', () => {
      store.castCard()
      expect(gridStore.cards).toHaveLength(0)
    })

    it('adds the on-deck card to the grid', () => {
      store.setCard(makeScryfallCard())
      store.castCard()
      expect(gridStore.cards).toHaveLength(1)
      expect(gridStore.cards[0]!.name).toBe('Lightning Bolt')
    })

    it('clears the on-deck card after casting', () => {
      store.setCard(makeScryfallCard())
      store.castCard()
      expect(store.card).toBeNull()
    })

    it('marks the most recent matching uncast history entry as cast', () => {
      const entry = makeHistoryEntry()
      historyStore.addEntry(entry)
      store.setCard(makeScryfallCard())
      store.castCard()
      expect(historyStore.entries[0]!.wasCast).toBe(true)
    })

    it('marks the most recent uncast entry, not an older one', () => {
      const scryfall = makeScryfallCard()
      const older = makeHistoryEntry({ id: 'old', scryfall_uri: scryfall.scryfall_uri })
      const newer = makeHistoryEntry({ id: 'new', scryfall_uri: scryfall.scryfall_uri })
      historyStore.addEntry(older)
      historyStore.addEntry(newer)

      store.setCard(scryfall)
      store.castCard()

      expect(historyStore.entries.find(e => e.id === 'new')!.wasCast).toBe(true)
      expect(historyStore.entries.find(e => e.id === 'old')!.wasCast).toBe(false)
    })

    it('does not mark an already-cast entry', () => {
      const scryfall = makeScryfallCard()
      const alreadyCast = makeHistoryEntry({
        scryfall_uri: scryfall.scryfall_uri,
        wasCast: true,
      })
      historyStore.addEntry(alreadyCast)

      store.setCard(scryfall)
      store.castCard()

      // The grid should still receive the card
      expect(gridStore.cards).toHaveLength(1)
      // The already-cast entry is unaffected (it was true before and stays true)
      expect(historyStore.entries[0]!.wasCast).toBe(true)
    })

    it('does not mark an entry for a different card', () => {
      const other = makeHistoryEntry({
        scryfall_uri: 'https://scryfall.com/card/other',
        wasCast: false,
      })
      historyStore.addEntry(other)

      store.setCard(makeScryfallCard()) // different scryfall_uri
      store.castCard()

      expect(historyStore.entries[0]!.wasCast).toBe(false)
    })

    it('still adds the card to the grid when no history entry matches', () => {
      // No entries in history at all
      store.setCard(makeScryfallCard())
      store.castCard()
      expect(gridStore.cards).toHaveLength(1)
    })
  })

  // ─── load() ─────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns false when there is no saved data', () => {
      mockLoad.mockReturnValue(null)
      expect(store.load()).toBe(false)
      expect(store.card).toBeNull()
    })

    it('returns true and restores a saved card', () => {
      const saved = {
        id: 'saved-id',
        name: 'Counterspell',
        mana_cost: '{U}{U}',
        image_uri: 'https://example.com/counterspell.jpg',
        scryfall_uri: 'https://scryfall.com/card/counterspell',
        instanceCount: 1,
        modifiers: [],
      }
      mockLoad.mockReturnValue(saved)
      expect(store.load()).toBe(true)
      expect(store.card).not.toBeNull()
      expect(store.card!.name).toBe('Counterspell')
    })
  })
})
