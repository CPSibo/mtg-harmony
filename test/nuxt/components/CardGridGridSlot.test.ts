import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { GridCard, Modifier } from '~/types/card'
import CardGridGridSlot from '~/components/CardGrid/CardGridGridSlot.vue'

// ─── Mock persistence and UI side effects ─────────────────────────────────────

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
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

function makeModifier(type: string, symbol: string): Modifier {
  return { id: crypto.randomUUID(), type, symbol }
}

/**
 * Triggers a contextmenu event on the filled-slot div and waits for the
 * teleported CardGridContextMenu to appear in document.body.
 */
async function openContextMenu(wrapper: VueWrapper): Promise<void> {
  // The filled-slot div carries the @contextmenu.prevent handler and always
  // has the cursor-pointer class when a card is rendered.
  await wrapper.find('.cursor-pointer').trigger('contextmenu')
  await nextTick()
}

/** Clicks the menu item with the given label inside document.body and awaits. */
async function clickMenuItem(label: string): Promise<void> {
  const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  const item = items.find(el => el.textContent?.includes(label))
  if (!item) throw new Error(`Menu item "${label}" not found in document.body`)
  item.click()
  await nextTick()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// NOTE: mountSuspended initialises the Nuxt app with its own @pinia/nuxt
// instance. Store state must be set up after mounting (mount-first pattern).
// Teleported content (context menu, zoom overlay) lives in document.body and
// must be queried there rather than through the wrapper.

describe('CardGridGridSlot', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    _cardIndex = 0
  })

  afterEach(() => {
    useGridStore().clearAll()
    wrapper?.unmount()
  })

  // ─── Empty slot ─────────────────────────────────────────────────────────────

  describe('empty slot (card = null)', () => {
    it('renders a dashed placeholder in full mode', async () => {
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card: null, displayMode: 'full' },
      })
      expect(wrapper.find('.border-dashed').exists()).toBe(true)
    })

    it('renders a dashed placeholder in compact mode', async () => {
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card: null, displayMode: 'compact' },
      })
      expect(wrapper.find('.border-dashed').exists()).toBe(true)
    })
  })

  // ─── Full mode — normal view ─────────────────────────────────────────────────

  describe('full mode — normal view', () => {
    it('renders the card image with the correct src', async () => {
      const card = makeCard({ image_uri: 'https://example.com/bolt.jpg' })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.find('img').attributes('src')).toBe('https://example.com/bolt.jpg')
    })

    it('applies rotate-90 to the image when the card is tapped', async () => {
      const card = makeCard({ tapped: true })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.find('img').classes()).toContain('rotate-90')
    })

    it('does not apply rotate-90 to the image when the card is untapped', async () => {
      const card = makeCard({ tapped: false })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.find('img').classes()).not.toContain('rotate-90')
    })

    it('shows the instance count badge', async () => {
      const card = makeCard({ instanceCount: 3 })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.text()).toContain('3')
    })

    it('renders one chip per distinct modifier type', async () => {
      const card = makeCard({
        modifiers: [
          makeModifier('Flying', 'ms ms-ability-flying'),
          makeModifier('Haste', 'ms ms-ability-haste'),
        ],
      })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.findAll('button[title="Flying"]')).toHaveLength(1)
      expect(wrapper.findAll('button[title="Haste"]')).toHaveLength(1)
    })

    it('shows a ×N count on a chip when the same modifier type appears multiple times', async () => {
      const card = makeCard({
        modifiers: [
          makeModifier('+1/+1', 'ms ms-counter-plus'),
          makeModifier('+1/+1', 'ms ms-counter-plus'),
          makeModifier('+1/+1', 'ms ms-counter-plus'),
        ],
      })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      expect(wrapper.find('button[title="+1/+1"]').text()).toContain('×3')
    })
  })

  // ─── Compact mode — normal view ──────────────────────────────────────────────

  describe('compact mode — normal view', () => {
    it('renders the card name', async () => {
      const card = makeCard({ name: 'Lightning Bolt' })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'compact' },
      })
      expect(wrapper.text()).toContain('Lightning Bolt')
    })

    it('applies opacity-60 when the card is tapped', async () => {
      const card = makeCard({ tapped: true })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'compact' },
      })
      expect(wrapper.find('.opacity-60').exists()).toBe(true)
    })

    it('shows the ms-tap icon when the card is tapped', async () => {
      const card = makeCard({ tapped: true })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'compact' },
      })
      expect(wrapper.find('.ms-tap').exists()).toBe(true)
    })

    it('does not show the ms-tap icon when the card is untapped', async () => {
      const card = makeCard({ tapped: false })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'compact' },
      })
      expect(wrapper.find('.ms-tap').exists()).toBe(false)
    })

    it('renders modifier chips in compact mode', async () => {
      const card = makeCard({
        modifiers: [makeModifier('Flying', 'ms ms-ability-flying')],
      })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'compact' },
      })
      expect(wrapper.find('button[title="Flying"]').exists()).toBe(true)
    })
  })

  // ─── Tap / untap on click ────────────────────────────────────────────────────

  describe('tap / untap on click', () => {
    it('calls gridStore.toggleTapped with the card id when the slot is clicked', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      const grid = useGridStore()
      grid.addCard(card)
      await wrapper.find('.cursor-pointer').trigger('click')
      expect(grid.cards[0]!.tapped).toBe(true)
    })

    it('toggles back to untapped on a second click', async () => {
      const card = makeCard({ tapped: true })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      const grid = useGridStore()
      grid.addCard(card)
      await wrapper.find('.cursor-pointer').trigger('click')
      expect(grid.cards[0]!.tapped).toBe(false)
    })
  })

  // ─── Context menu ────────────────────────────────────────────────────────────

  describe('context menu', () => {
    it('opens the context menu on a right-click (contextmenu event)', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull()
    })

    it('closes the context menu when CardGridContextMenu emits close', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(document.body.querySelector('[role="menu"]')).toBeNull()
    })
  })

  // ─── Context menu actions ────────────────────────────────────────────────────

  describe('context menu actions', () => {
    it('emits requestRemove with the card id when the Remove action fires', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      await clickMenuItem('Remove')
      expect(wrapper.emitted('requestRemove')).toEqual([[card.id]])
    })

    it('emits requestAddModifier with the card id when the Add modifier action fires', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      await clickMenuItem('Add modifier')
      expect(wrapper.emitted('requestAddModifier')).toEqual([[card.id]])
    })

    it('calls gridStore.duplicateCard when the Duplicate action fires', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      const grid = useGridStore()
      grid.addCard(card)
      await openContextMenu(wrapper)
      await clickMenuItem('Duplicate')
      expect(grid.cards).toHaveLength(2)
    })
  })

  // ─── Modifier chips ──────────────────────────────────────────────────────────

  describe('modifier chips', () => {
    it('clicking a modifier chip emits requestAddModifier with the card id', async () => {
      const card = makeCard({
        modifiers: [makeModifier('Flying', 'ms ms-ability-flying')],
      })
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await wrapper.find('button[title="Flying"]').trigger('click')
      expect(wrapper.emitted('requestAddModifier')).toEqual([[card.id]])
    })
  })

  // ─── Zoom overlay ────────────────────────────────────────────────────────────

  describe('zoom overlay', () => {
    it('opens the zoom overlay when the Zoom context menu action fires', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      await clickMenuItem('Zoom')
      expect(document.body.querySelector('.fixed.inset-0.z-50')).not.toBeNull()
    })

    it('closes the zoom overlay when the backdrop is clicked', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      await clickMenuItem('Zoom')
      const overlay = document.body.querySelector<HTMLElement>('.fixed.inset-0.z-50')!
      overlay.click()
      await nextTick()
      expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
    })

    it('closes the zoom overlay when ESC is pressed', async () => {
      const card = makeCard()
      wrapper = await mountSuspended(CardGridGridSlot, {
        props: { card, displayMode: 'full' },
      })
      await openContextMenu(wrapper)
      await clickMenuItem('Zoom')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
    })
  })
})
