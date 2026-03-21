import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { HistoryEntry } from '~/types/card'
import HistoryModal from '~/components/HistoryModal/index.vue'

// ─── Mock persistence ─────────────────────────────────────────────────────────
// Prevents useLocalStorage from touching localStorage or calling useToast.

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

// NOTE: mountSuspended initialises the Nuxt app with its own @pinia/nuxt
// instance. Store state must be set up after mounting to target the correct
// store instance. See CardGridGridPaginator.test.ts for more detail.

describe('HistoryModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    _entryIndex = 0
  })

  afterEach(() => {
    // Clear store state to prevent leaking into subsequent tests.
    useHistoryStore().clearAll()
    wrapper?.unmount()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('is not rendered when open is false', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: false } })
    expect(document.body.querySelector('h2')).toBeNull()
  })

  it('shows an empty-state message when there are no entries', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    expect(document.body.textContent).toContain('No cards fetched yet.')
  })

  it('renders a row for each history entry when open', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    const history = useHistoryStore()
    history.addEntry(makeEntry())
    history.addEntry(makeEntry())
    await nextTick()
    expect(document.body.querySelectorAll('li')).toHaveLength(2)
  })

  it('shows a "Cast" badge only on entries where wasCast is true', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    const history = useHistoryStore()
    history.addEntry(makeEntry({ cardName: 'Alpha', wasCast: false }))
    history.addEntry(makeEntry({ cardName: 'Beta', wasCast: true }))
    await nextTick()
    const rows = document.body.querySelectorAll('li')
    expect(rows[0]!.textContent).not.toContain('Cast')
    expect(rows[1]!.textContent).toContain('Cast')
  })

  it('renders card names as links to their scryfall_uri', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    const history = useHistoryStore()
    history.addEntry(makeEntry({
      cardName: 'Lightning Bolt',
      scryfall_uri: 'https://scryfall.com/card/bolt',
    }))
    await nextTick()
    const link = document.body.querySelector<HTMLAnchorElement>('a')!
    expect(link.textContent?.trim()).toBe('Lightning Bolt')
    expect(link.href).toContain('scryfall.com/card/bolt')
  })

  // ─── Close interactions ────────────────────────────────────────────────────

  it('emits update:open false when the close button is clicked', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    const closeBtn = document.body.querySelector<HTMLElement>('[aria-label="Close history"]')!
    closeBtn.click()
    await nextTick()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('emits update:open false when the ESC key is pressed', async () => {
    wrapper = await mountSuspended(HistoryModal, { props: { open: true } })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
