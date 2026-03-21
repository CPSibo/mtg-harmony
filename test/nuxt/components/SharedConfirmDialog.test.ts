import { describe, afterEach, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import SharedConfirmDialog from '~/components/shared/SharedConfirmDialog.vue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns all <button> elements currently in document.body (including teleported content). */
function bodyButtons(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>('button')]
}

/** Finds a button in document.body whose trimmed text matches label. */
function findButton(label: string): HTMLButtonElement {
  const btn = bodyButtons().find(b => b.textContent?.trim() === label)
  if (!btn) throw new Error(`Button "${label}" not found in document.body`)
  return btn
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SharedConfirmDialog', () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper?.unmount()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('is not rendered when open is false', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: false, title: 'Delete?', message: 'Are you sure?' },
    })
    expect(document.body.querySelector('h2')).toBeNull()
  })

  it('renders title and message when open is true', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'Delete?', message: 'Are you sure?' },
    })
    expect(document.body.querySelector('h2')?.textContent?.trim()).toBe('Delete?')
    expect(document.body.querySelector('p')?.textContent?.trim()).toBe('Are you sure?')
  })

  it('renders "Confirm" and "Cancel" as default button labels', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    const labels = bodyButtons().map(b => b.textContent?.trim())
    expect(labels).toContain('Cancel')
    expect(labels).toContain('Confirm')
  })

  it('renders custom confirmLabel and cancelLabel when provided', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M', confirmLabel: 'Remove', cancelLabel: 'Keep' },
    })
    const labels = bodyButtons().map(b => b.textContent?.trim())
    expect(labels).toContain('Keep')
    expect(labels).toContain('Remove')
  })

  // ─── Confirm button ────────────────────────────────────────────────────────

  it('emits confirm when the confirm button is clicked', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    findButton('Confirm').click()
    await nextTick()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('does not emit update:open when the confirm button is clicked', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    findButton('Confirm').click()
    await nextTick()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  // ─── Cancel / close ────────────────────────────────────────────────────────

  it('emits cancel and update:open false when the cancel button is clicked', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    findButton('Cancel').click()
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('emits cancel and update:open false when the ESC key is pressed', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('emits cancel and update:open false when the backdrop is clicked', async () => {
    wrapper = await mountSuspended(SharedConfirmDialog, {
      props: { open: true, title: 'T', message: 'M' },
    })
    const backdrop = document.body.querySelector<HTMLElement>('.absolute.inset-0')!
    backdrop.click()
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
