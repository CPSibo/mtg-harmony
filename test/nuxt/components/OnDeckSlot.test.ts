import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { ScryfallCard } from '~/types/card'
import OnDeckSlot from '~/components/OnDeckSlot/index.vue'

// ─── Mock persistence and UI side effects ─────────────────────────────────────

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
})

mockNuxtImport('useScryfall', () => {
  return () => ({ loading: ref(false), fetch: vi.fn() })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _cardIndex = 0

function makeScryfallCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  const i = ++_cardIndex
  return {
    id: `card-${i}`,
    name: `Card ${i}`,
    mana_cost: '{1}',
    image_uris: { border_crop: 'https://example.com/card.jpg' },
    scryfall_uri: `https://scryfall.com/card/test-${i}`,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// NOTE: mountSuspended initialises the Nuxt app with its own @pinia/nuxt
// instance. Store state must be set up after mounting (mount-first pattern).
// Teleported content (zoom overlay) lives in document.body and must be
// queried there rather than through the wrapper.

describe('OnDeckSlot', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    _cardIndex = 0
  })

  afterEach(() => {
    useOnDeckStore().clearCard()
    wrapper?.unmount()
  })

  // ─── Zoom overlay — expanded mode ────────────────────────────────────────────

  describe('zoom overlay (expanded mode)', () => {
    it('opens the zoom overlay when the card image is clicked', async () => {
      wrapper = await mountSuspended(OnDeckSlot)
      const onDeck = useOnDeckStore()
      const settings = useSettingsStore()
      settings.onDeckExpanded = true
      onDeck.setCard(makeScryfallCard())
      await nextTick()
      await wrapper.find('img').trigger('click')
      expect(document.body.querySelector('.fixed.inset-0.z-50')).not.toBeNull()
    })

    it('closes the zoom overlay when the backdrop is clicked', async () => {
      wrapper = await mountSuspended(OnDeckSlot)
      const onDeck = useOnDeckStore()
      const settings = useSettingsStore()
      settings.onDeckExpanded = true
      onDeck.setCard(makeScryfallCard())
      await nextTick()
      await wrapper.find('img').trigger('click')
      const overlay = document.body.querySelector<HTMLElement>('.fixed.inset-0.z-50')!
      overlay.click()
      await nextTick()
      expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
    })

    it('closes the zoom overlay when ESC is pressed', async () => {
      wrapper = await mountSuspended(OnDeckSlot)
      const onDeck = useOnDeckStore()
      const settings = useSettingsStore()
      settings.onDeckExpanded = true
      onDeck.setCard(makeScryfallCard())
      await nextTick()
      await wrapper.find('img').trigger('click')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
    })
  })

  // ─── Zoom overlay — shrunk mode ──────────────────────────────────────────────

  describe('zoom overlay (shrunk mode)', () => {
    it('opens the zoom overlay when the card image is clicked', async () => {
      wrapper = await mountSuspended(OnDeckSlot)
      const onDeck = useOnDeckStore()
      const settings = useSettingsStore()
      settings.onDeckExpanded = false
      onDeck.setCard(makeScryfallCard())
      await nextTick()
      await wrapper.find('img').trigger('click')
      expect(document.body.querySelector('.fixed.inset-0.z-50')).not.toBeNull()
    })

    it('closes the zoom overlay when the backdrop is clicked', async () => {
      wrapper = await mountSuspended(OnDeckSlot)
      const onDeck = useOnDeckStore()
      const settings = useSettingsStore()
      settings.onDeckExpanded = false
      onDeck.setCard(makeScryfallCard())
      await nextTick()
      await wrapper.find('img').trigger('click')
      const overlay = document.body.querySelector<HTMLElement>('.fixed.inset-0.z-50')!
      overlay.click()
      await nextTick()
      expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
    })
  })
})
