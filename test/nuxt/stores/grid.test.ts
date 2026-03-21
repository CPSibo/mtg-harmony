import { describe, beforeEach, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { GridCard } from '~/types/card'

// ─── Mock persistence ────────────────────────────────────────────────────────
// Prevents useLocalStorage from touching real localStorage or calling useToast.

const mockSave = vi.fn()
const mockLoad = vi.fn<() => unknown>(() => null)

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: mockSave, load: mockLoad })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _cardIndex = 0

function makeCard(overrides: Partial<GridCard> = {}): GridCard {
  const i = ++_cardIndex
  return {
    id: `card-${i}`,
    name: `Card ${i}`,
    mana_cost: '{1}',
    image_uri: 'https://example.com/card.jpg',
    scryfall_uri: `https://scryfall.com/card/test-${i}`,
    instanceCount: 1,
    modifiers: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useGridStore', () => {
  let grid: ReturnType<typeof useGridStore>
  let settings: ReturnType<typeof useSettingsStore>

  beforeEach(() => {
    _cardIndex = 0
    setActivePinia(createPinia())
    settings = useSettingsStore()
    grid = useGridStore()
    mockLoad.mockReturnValue(null)
    mockSave.mockClear()
  })

  // ─── Initial state ──────────────────────────────────────────────────────

  it('starts with no cards, on page 0, with 1 total page', () => {
    expect(grid.cards).toHaveLength(0)
    expect(grid.currentPage).toBe(0)
    expect(grid.totalPages).toBe(1)
  })

  // ─── addCard ───────────────────────────────────────────────────────────

  it('addCard appends a card', () => {
    grid.addCard(makeCard())
    expect(grid.cards).toHaveLength(1)
  })

  it('addCard stays on page 0 while slots remain', () => {
    settings.setSlotsPerPage(3)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    expect(grid.currentPage).toBe(0)
  })

  it('addCard navigates to the page that contains the new card when it overflows', () => {
    settings.setSlotsPerPage(3)
    for (let i = 0; i < 3; i++) grid.addCard(makeCard())
    grid.addCard(makeCard()) // 4th card → page 1
    expect(grid.currentPage).toBe(1)
  })

  it('addCard with slotsPerPage=1 always moves to the last page', () => {
    settings.setSlotsPerPage(1)
    for (let i = 0; i < 5; i++) grid.addCard(makeCard())
    expect(grid.currentPage).toBe(4)
  })

  // ─── removeCard ────────────────────────────────────────────────────────

  it('removeCard removes the card with the given ID', () => {
    const card = makeCard()
    grid.addCard(card)
    grid.removeCard(card.id)
    expect(grid.cards).toHaveLength(0)
  })

  it('removeCard is a no-op for an unknown ID', () => {
    grid.addCard(makeCard())
    grid.removeCard('non-existent')
    expect(grid.cards).toHaveLength(1)
  })

  it('removeCard clamps currentPage when the page no longer exists', () => {
    settings.setSlotsPerPage(1)
    const a = makeCard()
    const b = makeCard()
    grid.addCard(a) // page 0
    grid.addCard(b) // page 1 — currentPage advances
    expect(grid.currentPage).toBe(1)
    grid.removeCard(b.id) // page 1 disappears
    expect(grid.currentPage).toBe(0)
  })

  // ─── duplicateCard ─────────────────────────────────────────────────────

  it('duplicateCard inserts a copy immediately after the original', () => {
    const a = makeCard({ name: 'Alpha' })
    const b = makeCard({ name: 'Beta' })
    grid.addCard(a)
    grid.addCard(b)
    grid.duplicateCard(a.id)
    expect(grid.cards).toHaveLength(3)
    expect(grid.cards[1]!.name).toBe('Alpha')
    expect(grid.cards[2]!.name).toBe('Beta')
  })

  it('duplicateCard assigns the copy a distinct ID', () => {
    const card = makeCard()
    grid.addCard(card)
    grid.duplicateCard(card.id)
    expect(grid.cards[0]!.id).not.toBe(grid.cards[1]!.id)
  })

  it('duplicateCard resets instanceCount to 1 on the copy', () => {
    const card = makeCard({ instanceCount: 3 })
    grid.addCard(card)
    grid.duplicateCard(card.id)
    expect(grid.cards[1]!.instanceCount).toBe(1)
  })

  it('duplicateCard clears modifiers on the copy', () => {
    const card = makeCard({
      modifiers: [{ id: 'm1', type: 'Flying', symbol: 'ms ms-ability-flying' }],
    })
    grid.addCard(card)
    grid.duplicateCard(card.id)
    expect(grid.cards[1]!.modifiers).toHaveLength(0)
  })

  it('duplicateCard is a no-op for an unknown ID', () => {
    grid.duplicateCard('non-existent')
    expect(grid.cards).toHaveLength(0)
  })

  // ─── updateCard ────────────────────────────────────────────────────────

  it('updateCard merges a partial update', () => {
    const card = makeCard({ instanceCount: 1 })
    grid.addCard(card)
    grid.updateCard(card.id, { instanceCount: 4 })
    expect(grid.cards[0]!.instanceCount).toBe(4)
  })

  it('updateCard leaves un-patched fields untouched', () => {
    const card = makeCard({ name: 'Untouched', instanceCount: 1 })
    grid.addCard(card)
    grid.updateCard(card.id, { instanceCount: 2 })
    expect(grid.cards[0]!.name).toBe('Untouched')
  })

  it('updateCard is a no-op for an unknown ID', () => {
    const card = makeCard()
    grid.addCard(card)
    grid.updateCard('non-existent', { instanceCount: 99 })
    expect(grid.cards[0]!.instanceCount).toBe(1)
  })

  // ─── clearAll ──────────────────────────────────────────────────────────

  it('clearAll removes all cards and resets to page 0', () => {
    settings.setSlotsPerPage(2)
    for (let i = 0; i < 5; i++) grid.addCard(makeCard())
    grid.clearAll()
    expect(grid.cards).toHaveLength(0)
    expect(grid.currentPage).toBe(0)
  })

  // ─── totalPages ────────────────────────────────────────────────────────

  it('totalPages is 1 when there are no cards', () => {
    settings.setSlotsPerPage(9)
    expect(grid.totalPages).toBe(1)
  })

  it('totalPages divides cards by slotsPerPage and rounds up', () => {
    settings.setSlotsPerPage(3)
    for (let i = 0; i < 7; i++) grid.addCard(makeCard())
    expect(grid.totalPages).toBe(3) // ⌈7/3⌉ = 3
  })

  it('totalPages is exactly 1 when cards fill a whole page', () => {
    settings.setSlotsPerPage(4)
    for (let i = 0; i < 4; i++) grid.addCard(makeCard())
    expect(grid.totalPages).toBe(1)
  })

  // ─── pageCards ─────────────────────────────────────────────────────────

  it('pageCards returns the correct slice for page 0', () => {
    settings.setSlotsPerPage(2)
    const cards = [makeCard(), makeCard(), makeCard()]
    cards.forEach(c => grid.addCard(c))
    grid.setPage(0)
    expect(grid.pageCards.map(c => c.id)).toEqual([cards[0]!.id, cards[1]!.id])
  })

  it('pageCards returns the correct slice for a non-zero page', () => {
    settings.setSlotsPerPage(2)
    const cards = [makeCard(), makeCard(), makeCard(), makeCard(), makeCard()]
    cards.forEach(c => grid.addCard(c))
    grid.setPage(1)
    expect(grid.pageCards.map(c => c.id)).toEqual([cards[2]!.id, cards[3]!.id])
  })

  it('pageCards returns a partial slice on the last page', () => {
    settings.setSlotsPerPage(3)
    const cards = [makeCard(), makeCard(), makeCard(), makeCard()]
    cards.forEach(c => grid.addCard(c))
    grid.setPage(1)
    expect(grid.pageCards.map(c => c.id)).toEqual([cards[3]!.id])
  })

  // ─── setPage / nextPage / prevPage ─────────────────────────────────────

  it('setPage clamps negative values to 0', () => {
    grid.setPage(-5)
    expect(grid.currentPage).toBe(0)
  })

  it('setPage clamps values above totalPages-1 to the last page', () => {
    settings.setSlotsPerPage(3)
    for (let i = 0; i < 3; i++) grid.addCard(makeCard()) // 1 page
    grid.setPage(99)
    expect(grid.currentPage).toBe(0)
  })

  it('nextPage increments the page', () => {
    settings.setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    grid.setPage(0)
    grid.nextPage()
    expect(grid.currentPage).toBe(1)
  })

  it('nextPage does not go past the last page', () => {
    settings.setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.setPage(0)
    grid.nextPage()
    expect(grid.currentPage).toBe(0) // still only 1 page
  })

  it('prevPage decrements the page', () => {
    settings.setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    grid.setPage(1)
    grid.prevPage()
    expect(grid.currentPage).toBe(0)
  })

  it('prevPage does not go below 0', () => {
    grid.setPage(0)
    grid.prevPage()
    expect(grid.currentPage).toBe(0)
  })

  // ─── slotsPerPage change clamps currentPage ────────────────────────────
  // In the running app, a watch(slotsPerPage) in the store fires this automatically.
  // In isolated Pinia tests the Vue scheduler doesn't flush, so we verify the
  // clamping logic via setPage — which is exactly what the watcher calls.

  it('setPage correctly clamps an out-of-range page after slotsPerPage increases', () => {
    settings.setSlotsPerPage(2)
    for (let i = 0; i < 4; i++) grid.addCard(makeCard())
    grid.setPage(1) // page 1 is valid when slotsPerPage = 2 (2 pages)
    settings.setSlotsPerPage(9) // all 4 cards now fit on page 0
    expect(grid.totalPages).toBe(1) // verify totalPages recomputed
    grid.setPage(grid.currentPage) // simulate the watch: clamp in place
    expect(grid.currentPage).toBe(0)
  })

  // ─── load / save ───────────────────────────────────────────────────────

  it('load returns false and leaves cards empty when there is no saved data', () => {
    mockLoad.mockReturnValue(null)
    expect(grid.load()).toBe(false)
    expect(grid.cards).toHaveLength(0)
  })

  it('load returns true and hydrates cards from persisted data', () => {
    const saved = [makeCard(), makeCard()]
    mockLoad.mockReturnValue({ cards: saved, currentPage: 0 })
    expect(grid.load()).toBe(true)
    expect(grid.cards).toHaveLength(2)
    expect(grid.cards[0]!.id).toBe(saved[0]!.id)
  })

  it('load restores the saved currentPage', () => {
    settings.setSlotsPerPage(1)
    const saved = [makeCard(), makeCard()]
    mockLoad.mockReturnValue({ cards: saved, currentPage: 1 })
    grid.load()
    expect(grid.currentPage).toBe(1)
  })
})
