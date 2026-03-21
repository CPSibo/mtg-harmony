import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { GridCard } from '~/types/card'
import CardGridGridPaginator from '~/components/CardGrid/CardGridGridPaginator.vue'

// ─── Mock persistence ─────────────────────────────────────────────────────────
// Prevents useLocalStorage from touching localStorage or calling useToast.

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    tapped: false,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// NOTE: mountSuspended initialises the Nuxt app with its own @pinia/nuxt
// instance, which replaces any setActivePinia() call made before mounting.
// For component tests that depend on stores, the pattern is:
//   1. Mount the component first.
//   2. Call useXxxStore() after mounting (now returns the Nuxt app's instance).
//   3. Set up store state, await nextTick(), then assert.

describe('CardGridGridPaginator', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    _cardIndex = 0
  })

  afterEach(() => {
    // Clear store state to prevent leaking into subsequent tests.
    useGridStore().clearAll()
    wrapper?.unmount()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('is not rendered when there is only one page', async () => {
    // No cards → totalPages = 1 → paginator hidden.
    wrapper = await mountSuspended(CardGridGridPaginator)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders prev and next buttons when there is more than one page', async () => {
    wrapper = await mountSuspended(CardGridGridPaginator)
    useSettingsStore().setSlotsPerPage(1)
    useGridStore().addCard(makeCard())
    useGridStore().addCard(makeCard())
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  // ─── Button states ─────────────────────────────────────────────────────────

  it('prev button is disabled on page 0', async () => {
    wrapper = await mountSuspended(CardGridGridPaginator)
    const grid = useGridStore()
    useSettingsStore().setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    grid.setPage(0)
    await nextTick()
    // buttons[0] = prev, buttons[1] = next (template order)
    expect(wrapper.findAll<HTMLButtonElement>('button')[0]!.element.disabled).toBe(true)
  })

  it('next button is disabled on the last page', async () => {
    wrapper = await mountSuspended(CardGridGridPaginator)
    const grid = useGridStore()
    useSettingsStore().setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    // addCard moves currentPage to the last card's page, so it is already 1.
    await nextTick()
    expect(wrapper.findAll<HTMLButtonElement>('button')[1]!.element.disabled).toBe(true)
  })

  // ─── Interactions ──────────────────────────────────────────────────────────

  it('clicking next advances to the next page', async () => {
    wrapper = await mountSuspended(CardGridGridPaginator)
    const grid = useGridStore()
    useSettingsStore().setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    grid.setPage(0)
    await nextTick()
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(useGridStore().currentPage).toBe(1)
  })

  it('clicking prev goes back to the previous page', async () => {
    wrapper = await mountSuspended(CardGridGridPaginator)
    const grid = useGridStore()
    useSettingsStore().setSlotsPerPage(1)
    grid.addCard(makeCard())
    grid.addCard(makeCard())
    // currentPage is 1 after the second addCard; navigate back.
    await nextTick()
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(useGridStore().currentPage).toBe(0)
  })
})
