import { describe, afterEach, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { Modifier } from '~/types/card'
import SharedModifierPickerDialog from '~/components/shared/SharedModifierPickerDialog.vue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the grid tile element for the modifier with the given type label.
 * Each tile is a direct child of the grid div and contains the type text.
 */
function findTile(typeLabel: string): Element {
  const tiles = document.body.querySelectorAll('.grid > div')
  const tile = [...tiles].find(t => t.textContent?.includes(typeLabel))
  if (!tile) throw new Error(`Tile for modifier type "${typeLabel}" not found`)
  return tile
}

/** Returns the decrement (−) and increment (+) buttons inside a modifier tile. */
function tileButtons(tile: Element): [HTMLButtonElement, HTMLButtonElement] {
  const btns = tile.querySelectorAll<HTMLButtonElement>('button')
  if (btns.length < 2) throw new Error('Expected 2 buttons in tile')
  return [btns[0]!, btns[1]!]
}

/** Returns the count display span inside a modifier tile. */
function tileCount(tile: Element): number {
  return Number(tile.querySelector('.tabular-nums')?.textContent?.trim() ?? '-1')
}

/** Finds a button in document.body whose trimmed text matches label. */
function findButton(label: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(b => b.textContent?.trim() === label)
  if (!btn) throw new Error(`Button "${label}" not found in document.body`)
  return btn
}

function makeModifier(overrides: Partial<Modifier> = {}): Modifier {
  return {
    id: crypto.randomUUID(),
    type: 'Flying',
    symbol: 'ms ms-ability-flying',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SharedModifierPickerDialog', () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper?.unmount()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('is not rendered when open is false', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: false, cardName: 'Lightning Bolt', currentModifiers: [] },
    })
    expect(document.body.querySelector('h2')).toBeNull()
  })

  it('renders the card name in the dialog title when open', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Lightning Bolt', currentModifiers: [] },
    })
    expect(document.body.querySelector('h2')?.textContent).toContain('Lightning Bolt')
  })

  it('renders a tile for every one of the 20 modifier types', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const tiles = document.body.querySelectorAll('.grid > div')
    expect(tiles).toHaveLength(20)
  })

  // ─── Count initialisation ──────────────────────────────────────────────────

  it('initialises all counts to 0 when currentModifiers is empty', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const tiles = document.body.querySelectorAll('.grid > div')
    const counts = [...tiles].map(t => tileCount(t))
    expect(counts.every(c => c === 0)).toBe(true)
  })

  it('initialises counts from currentModifiers when the dialog opens', async () => {
    const mod = makeModifier({ type: 'Flying', symbol: 'ms ms-ability-flying' })
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: false, cardName: 'Test', currentModifiers: [mod] },
    })
    await wrapper.setProps({ open: true })
    await nextTick()
    expect(tileCount(findTile('Flying'))).toBe(1)
  })

  // ─── Count interaction ─────────────────────────────────────────────────────

  it('+ button increments the count for that modifier type', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const [, increment] = tileButtons(findTile('Flying'))
    increment.click()
    await nextTick()
    expect(tileCount(findTile('Flying'))).toBe(1)
  })

  it('− button decrements the count for that modifier type', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const [, increment] = tileButtons(findTile('Flying'))
    const [decrement] = tileButtons(findTile('Flying'))
    increment.click()
    await nextTick()
    decrement.click()
    await nextTick()
    expect(tileCount(findTile('Flying'))).toBe(0)
  })

  it('− button is disabled when the count is already 0', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const [decrement] = tileButtons(findTile('Flying'))
    expect(decrement.disabled).toBe(true)
  })

  // ─── Apply ─────────────────────────────────────────────────────────────────

  it('emits apply with the correct Modifier[] and emits update:open false', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const [, increment] = tileButtons(findTile('Flying'))
    increment.click()
    await nextTick()
    findButton('Apply').click()
    await nextTick()
    // emit('apply', modifiers) → emitted('apply') = [[modifiers]], so [0][0] is the Modifier[].
    const modifiers = (wrapper.emitted('apply') as [Modifier[]][])[0]![0]!
    expect(modifiers).toHaveLength(1)
    expect(modifiers[0]!.type).toBe('Flying')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('preserves existing modifier IDs for modifiers that were already present', async () => {
    const existing = makeModifier({ id: 'existing-id', type: 'Flying' })
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: false, cardName: 'Test', currentModifiers: [existing] },
    })
    await wrapper.setProps({ open: true })
    await nextTick()
    findButton('Apply').click()
    await nextTick()
    const modifiers = (wrapper.emitted('apply') as [Modifier[]][])[0]![0]!
    expect(modifiers[0]!.id).toBe('existing-id')
  })

  it('assigns new IDs to newly added modifiers', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    const [, increment] = tileButtons(findTile('Flying'))
    increment.click()
    await nextTick()
    findButton('Apply').click()
    await nextTick()
    const modifiers = (wrapper.emitted('apply') as [Modifier[]][])[0]![0]!
    expect(typeof modifiers[0]!.id).toBe('string')
    expect(modifiers[0]!.id.length).toBeGreaterThan(0)
  })

  // ─── Cancel / close ────────────────────────────────────────────────────────

  it('emits cancel and update:open false when the Cancel button is clicked', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    findButton('Cancel').click()
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('emits cancel and update:open false when the ESC key is pressed', async () => {
    wrapper = await mountSuspended(SharedModifierPickerDialog, {
      props: { open: true, cardName: 'Test', currentModifiers: [] },
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
