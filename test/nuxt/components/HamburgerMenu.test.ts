import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { GridCard } from '~/types/card'
import HamburgerMenu from '~/components/HamburgerMenu/index.vue'

// ─── Mock persistence and UI side effects ─────────────────────────────────────

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
})

const mockRequestWakeLock = vi.fn()
const mockReleaseWakeLock = vi.fn()

mockNuxtImport('useWakeLock', () => {
  return () => ({
    isSupported: ref(true),
    isActive: ref(false),
    request: mockRequestWakeLock,
    release: mockReleaseWakeLock,
  })
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

/**
 * Clicks the settings button (in the non-teleported header) and waits for the
 * teleported settings modal to appear in document.body.
 *
 * The header is part of the component's own DOM (not teleported), so it must
 * be accessed through the wrapper rather than via document.body.querySelector.
 */
async function openSettings(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[aria-label="Open settings"]').trigger('click')
  await nextTick()
}

/** Clicks a button inside document.body whose trimmed text matches label. */
async function clickBodyButton(label: string): Promise<void> {
  const btn = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(b => b.textContent?.trim() === label)
  if (!btn) throw new Error(`Button "${label}" not found in document.body`)
  btn.click()
  await nextTick()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// NOTE: mountSuspended initialises the Nuxt app with its own @pinia/nuxt
// instance. Use the mount-first pattern: call useXxxStore() after mounting.
//
// The settings modal, confirm dialogs, and history modal are all teleported to
// document.body and must be queried there. The header bar buttons are not
// teleported and must be accessed through the wrapper.

describe('HamburgerMenu', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    _cardIndex = 0
    mockRequestWakeLock.mockClear()
    mockReleaseWakeLock.mockClear()
  })

  afterEach(() => {
    useGridStore().clearAll()
    useHistoryStore().clearAll()
    wrapper?.unmount()
  })

  // ─── Header ─────────────────────────────────────────────────────────────────

  describe('header', () => {
    it('renders the app title', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      expect(wrapper.text()).toContain('MTG Harmony')
    })
  })

  // ─── History button ──────────────────────────────────────────────────────────

  describe('history button', () => {
    it('opens the history modal when the history button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await wrapper.find('[aria-label="View history"]').trigger('click')
      await nextTick()
      // HistoryModal teleports to body and renders an h2 when open
      expect(document.body.querySelector('h2')?.textContent).toContain('History')
    })
  })

  // ─── Settings modal ──────────────────────────────────────────────────────────

  describe('settings modal', () => {
    it('opens when the settings button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      expect(document.body.querySelector('h2')?.textContent?.trim()).toBe('Settings')
    })

    it('closes when the close (×) button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      const closeBtn = document.body.querySelector<HTMLElement>('[aria-label="Close settings"]')!
      closeBtn.click()
      await nextTick()
      expect(document.body.querySelector('[aria-label="Close settings"]')).toBeNull()
    })

    it('closes when the ESC key is pressed', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(document.body.querySelector('[aria-label="Close settings"]')).toBeNull()
    })

    it('closes when the backdrop is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      const backdrop = document.body.querySelector<HTMLElement>('.absolute.inset-0.cursor-pointer')!
      backdrop.click()
      await nextTick()
      expect(document.body.querySelector('[aria-label="Close settings"]')).toBeNull()
    })
  })

  // ─── Display mode buttons ────────────────────────────────────────────────────

  describe('display mode buttons', () => {
    it('marks the active display mode button as aria-pressed="true"', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      useSettingsStore().setDisplayMode('full')
      await openSettings(wrapper)
      const fullBtn = [...document.body.querySelectorAll<HTMLElement>('button')]
        .find(b => b.textContent?.trim() === 'Full')!
      expect(fullBtn.getAttribute('aria-pressed')).toBe('true')
    })

    it('calls settingsStore.setDisplayMode("compact") when Compact is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      await clickBodyButton('Compact')
      expect(useSettingsStore().gridDisplayMode).toBe('compact')
    })

    it('calls settingsStore.setDisplayMode("full") when Full is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      const settings = useSettingsStore()
      settings.setDisplayMode('compact') // start in compact so Full is a real change
      await openSettings(wrapper)
      await clickBodyButton('Full')
      expect(settings.gridDisplayMode).toBe('full')
    })
  })

  // ─── Card size buttons ───────────────────────────────────────────────────────

  describe('card size buttons', () => {
    it('calls settingsStore.setSlotSize("small") when the S button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      const btn = document.body.querySelector<HTMLElement>('[aria-label="small card size"]')!
      btn.click()
      await nextTick()
      expect(useSettingsStore().slotSize).toBe('small')
    })

    it('calls settingsStore.setSlotSize("large") when the L button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      const btn = document.body.querySelector<HTMLElement>('[aria-label="large card size"]')!
      btn.click()
      await nextTick()
      expect(useSettingsStore().slotSize).toBe('large')
    })
  })

  // ─── Clear grid ──────────────────────────────────────────────────────────────

  describe('clear grid', () => {
    it('opens the clear confirm dialog when "Clear grid" is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      await clickBodyButton('Clear grid')
      // The settings modal stays open while the confirm dialog opens on top;
      // check that the confirm dialog title is present among all h2 elements.
      const headings = [...document.body.querySelectorAll('h2')].map(h => h.textContent?.trim())
      expect(headings).toContain('Clear grid?')
    })

    it('calls gridStore.clearAll() when the clear confirm dialog is confirmed', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      const grid = useGridStore()
      grid.addCard(makeCard())
      grid.addCard(makeCard())
      await openSettings(wrapper)
      await clickBodyButton('Clear grid')
      await clickBodyButton('Clear') // confirm label defined in HamburgerMenu template
      expect(grid.cards).toHaveLength(0)
    })

    it('does not call gridStore.clearAll() when the dialog is cancelled', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      const grid = useGridStore()
      grid.addCard(makeCard())
      await openSettings(wrapper)
      await clickBodyButton('Clear grid')
      await clickBodyButton('Cancel')
      expect(grid.cards).toHaveLength(1)
    })
  })

  // ─── Reset app ───────────────────────────────────────────────────────────────

  describe('reset app', () => {
    it('opens the reset confirm dialog when "Reset app" is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      await clickBodyButton('Reset app')
      // The settings modal stays open while the confirm dialog opens on top;
      // check that the confirm dialog title is present among all h2 elements.
      const headings = [...document.body.querySelectorAll('h2')].map(h => h.textContent?.trim())
      expect(headings).toContain('Reset app?')
    })

    it('clears grid, on-deck card, and history when reset is confirmed', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      const grid = useGridStore()
      const history = useHistoryStore()
      const onDeck = useOnDeckStore()

      grid.addCard(makeCard())
      history.addEntry({
        id: 'e1',
        cardName: 'Lightning Bolt',
        mana_cost: '{R}',
        image_uri: 'https://example.com/lightning-bolt.jpg',
        scryfall_uri: 'https://scryfall.com/card/test',
        fetchedAt: new Date().toISOString(),
        wasCast: false,
      })

      await openSettings(wrapper)
      await clickBodyButton('Reset app')
      await clickBodyButton('Reset') // confirm label defined in HamburgerMenu template
      expect(grid.cards).toHaveLength(0)
      expect(history.entries).toHaveLength(0)
      expect(onDeck.card).toBeNull()
    })

    it('does not clear anything when reset is cancelled', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      const grid = useGridStore()
      grid.addCard(makeCard())
      await openSettings(wrapper)
      await clickBodyButton('Reset app')
      await clickBodyButton('Cancel')
      expect(grid.cards).toHaveLength(1)
    })
  })

  // ─── Wake lock toggle ────────────────────────────────────────────────────────

  describe('wake lock toggle', () => {
    it('renders the "Keep screen awake" label in the settings modal', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      await openSettings(wrapper)
      expect(document.body.textContent).toContain('Keep screen awake')
    })

    it('marks the wake lock Off button as aria-pressed="true" when wakeLockEnabled is false', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      useSettingsStore().setWakeLockEnabled(false)
      await openSettings(wrapper)
      const offBtn = document.body.querySelector<HTMLElement>('[aria-label="wake lock off"]')!
      expect(offBtn.getAttribute('aria-pressed')).toBe('true')
    })

    it('calls settingsStore.setWakeLockEnabled(true) when the wake lock On button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      useSettingsStore().setWakeLockEnabled(false)
      await openSettings(wrapper)
      const btn = document.body.querySelector<HTMLElement>('[aria-label="wake lock on"]')!
      btn.click()
      await nextTick()
      expect(useSettingsStore().wakeLockEnabled).toBe(true)
    })

    it('calls settingsStore.setWakeLockEnabled(false) when the wake lock Off button is clicked', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      useSettingsStore().setWakeLockEnabled(true)
      await nextTick()
      await openSettings(wrapper)
      const btn = document.body.querySelector<HTMLElement>('[aria-label="wake lock off"]')!
      btn.click()
      await nextTick()
      expect(useSettingsStore().wakeLockEnabled).toBe(false)
    })

    it('calls requestWakeLock when wakeLockEnabled becomes true', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      mockRequestWakeLock.mockClear()
      useSettingsStore().setWakeLockEnabled(true)
      await flushPromises()
      expect(mockRequestWakeLock).toHaveBeenCalledWith('screen')
    })

    it('calls releaseWakeLock when wakeLockEnabled becomes false', async () => {
      wrapper = await mountSuspended(HamburgerMenu)
      useSettingsStore().setWakeLockEnabled(true)
      await flushPromises()
      mockReleaseWakeLock.mockClear()
      useSettingsStore().setWakeLockEnabled(false)
      await flushPromises()
      expect(mockReleaseWakeLock).toHaveBeenCalled()
    })
  })
})
