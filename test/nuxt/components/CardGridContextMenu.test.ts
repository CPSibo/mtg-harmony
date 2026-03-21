import { describe, beforeEach, afterEach, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { GridCard } from '~/types/card'
import CardGridContextMenu from '~/components/CardGrid/CardGridContextMenu.vue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<GridCard> = {}): GridCard {
  return {
    id: 'test-card',
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    image_uri: 'https://example.com/card.jpg',
    scryfall_uri: 'https://scryfall.com/card/test',
    instanceCount: 1,
    modifiers: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CardGridContextMenu', () => {
  let wrapper: VueWrapper
  let anchorEl: HTMLDivElement

  beforeEach(() => {
    // onMounted calls getBoundingClientRect() on anchorEl; happy-dom returns
    // all-zeros, which is fine — positioning degrades gracefully to 0,0.
    anchorEl = document.createElement('div')
    document.body.appendChild(anchorEl)
  })

  afterEach(() => {
    wrapper?.unmount()
    anchorEl.remove()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('renders all five menu item labels', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const items = wrapper.findAll('[role="menuitem"]')
    const labels = items.map(i => i.text())
    expect(labels).toContain('Open info')
    expect(labels).toContain('Duplicate')
    expect(labels).toContain('Add count')
    expect(labels).toContain('Add modifier')
    expect(labels).toContain('Remove')
  })

  // ─── Menu item clicks ──────────────────────────────────────────────────────

  it('emits openInfo when "Open info" is clicked', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const btn = wrapper.findAll('[role="menuitem"]').find(b => b.text().includes('Open info'))!
    await btn.trigger('click')
    expect(wrapper.emitted('openInfo')).toHaveLength(1)
  })

  it('emits duplicate when "Duplicate" is clicked', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const btn = wrapper.findAll('[role="menuitem"]').find(b => b.text().includes('Duplicate'))!
    await btn.trigger('click')
    expect(wrapper.emitted('duplicate')).toHaveLength(1)
  })

  it('emits addCount when "Add count" is clicked', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const btn = wrapper.findAll('[role="menuitem"]').find(b => b.text().includes('Add count'))!
    await btn.trigger('click')
    expect(wrapper.emitted('addCount')).toHaveLength(1)
  })

  it('emits addModifier when "Add modifier" is clicked', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const btn = wrapper.findAll('[role="menuitem"]').find(b => b.text().includes('Add modifier'))!
    await btn.trigger('click')
    expect(wrapper.emitted('addModifier')).toHaveLength(1)
  })

  it('emits remove when "Remove" is clicked', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    const btn = wrapper.findAll('[role="menuitem"]').find(b => b.text().includes('Remove'))!
    await btn.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  // ─── Close interactions ────────────────────────────────────────────────────

  it('emits close when the ESC key is pressed', async () => {
    wrapper = await mountSuspended(CardGridContextMenu, {
      props: { card: makeCard(), anchorEl },
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
