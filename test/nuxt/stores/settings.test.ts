import { describe, beforeEach, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

// ─── Mock persistence ────────────────────────────────────────────────────────

const mockSave = vi.fn()
const mockLoad = vi.fn<() => unknown>(() => null)

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: mockSave, load: mockLoad })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockLoad.mockReturnValue(null)
    mockSave.mockClear()
  })

  // ─── Default slot size from viewport width ──────────────────────────────
  // getDefaultSlotSize() runs at store initialisation, so we set window.innerWidth
  // before creating a fresh Pinia + store in each case.

  describe('getDefaultSlotSize()', () => {
    it('returns "small" for widths below 768 px (mobile)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('small')
    })

    it('returns "small" for a width of 767 px (just below tablet boundary)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('small')
    })

    it('returns "medium" for widths from 768 to 1023 px (tablet)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('medium')
    })

    it('treats 768 px as the lower tablet boundary (medium)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('medium')
    })

    it('treats 1023 px as the upper tablet boundary (medium)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1023, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('medium')
    })

    it('returns "large" for widths of 1024 px and above (desktop)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('large')
    })

    it('treats 1024 px as the lower desktop boundary (large)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
      setActivePinia(createPinia())
      expect(useSettingsStore().slotSize).toBe('large')
    })
  })

  // ─── setSlotSize ────────────────────────────────────────────────────────

  describe('setSlotSize()', () => {
    it('updates slotSize', () => {
      const store = useSettingsStore()
      store.setSlotSize('small')
      expect(store.slotSize).toBe('small')
    })

    it('can be changed multiple times', () => {
      const store = useSettingsStore()
      store.setSlotSize('small')
      store.setSlotSize('large')
      expect(store.slotSize).toBe('large')
    })
  })

  // ─── setSlotsPerPage ────────────────────────────────────────────────────

  describe('setSlotsPerPage()', () => {
    it('updates slotsPerPage to the given value', () => {
      const store = useSettingsStore()
      store.setSlotsPerPage(12)
      expect(store.slotsPerPage).toBe(12)
    })

    it('clamps 0 to 1', () => {
      const store = useSettingsStore()
      store.setSlotsPerPage(0)
      expect(store.slotsPerPage).toBe(1)
    })

    it('clamps negative numbers to 1', () => {
      const store = useSettingsStore()
      store.setSlotsPerPage(-5)
      expect(store.slotsPerPage).toBe(1)
    })

    it('accepts large values unchanged', () => {
      const store = useSettingsStore()
      store.setSlotsPerPage(100)
      expect(store.slotsPerPage).toBe(100)
    })
  })

  // ─── setDisplayMode ─────────────────────────────────────────────────────

  describe('setDisplayMode()', () => {
    it('defaults to "full"', () => {
      expect(useSettingsStore().gridDisplayMode).toBe('full')
    })

    it('switches to "compact"', () => {
      const store = useSettingsStore()
      store.setDisplayMode('compact')
      expect(store.gridDisplayMode).toBe('compact')
    })

    it('switches back to "full"', () => {
      const store = useSettingsStore()
      store.setDisplayMode('compact')
      store.setDisplayMode('full')
      expect(store.gridDisplayMode).toBe('full')
    })
  })

  // ─── toggleOnDeckExpanded ───────────────────────────────────────────────

  describe('toggleOnDeckExpanded()', () => {
    it('flips the flag from its initial value', () => {
      const store = useSettingsStore()
      const initial = store.onDeckExpanded
      store.toggleOnDeckExpanded()
      expect(store.onDeckExpanded).toBe(!initial)
    })

    it('restores the original value when toggled twice', () => {
      const store = useSettingsStore()
      const initial = store.onDeckExpanded
      store.toggleOnDeckExpanded()
      store.toggleOnDeckExpanded()
      expect(store.onDeckExpanded).toBe(initial)
    })
  })

  // ─── load() ─────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns false when there is no saved data and applies the viewport default', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
      mockLoad.mockReturnValue(null)
      const store = useSettingsStore()
      expect(store.load()).toBe(false)
      expect(store.slotSize).toBe('small')
    })

    it('returns true and hydrates all settings from saved data', () => {
      mockLoad.mockReturnValue({
        slotSize: 'large',
        gridDisplayMode: 'compact',
        onDeckExpanded: false,
      })
      const store = useSettingsStore()
      expect(store.load()).toBe(true)
      expect(store.slotSize).toBe('large')
      expect(store.gridDisplayMode).toBe('compact')
      expect(store.onDeckExpanded).toBe(false)
    })

    it('ignores an invalid slotSize and leaves the current value unchanged', () => {
      const store = useSettingsStore()
      const before = store.slotSize
      mockLoad.mockReturnValue({ slotSize: 'gigantic', gridDisplayMode: 'full', onDeckExpanded: true })
      store.load()
      expect(store.slotSize).toBe(before)
    })

    it('ignores an invalid gridDisplayMode and leaves the current value unchanged', () => {
      const store = useSettingsStore()
      mockLoad.mockReturnValue({ slotSize: 'small', gridDisplayMode: 'grid', onDeckExpanded: true })
      store.load()
      expect(store.gridDisplayMode).toBe('full') // default unchanged
    })

    it('hydrates partial data — only present fields are updated', () => {
      mockLoad.mockReturnValue({ slotSize: 'small' }) // no gridDisplayMode / onDeckExpanded
      const store = useSettingsStore()
      store.load()
      expect(store.slotSize).toBe('small')
      expect(store.gridDisplayMode).toBe('full') // unchanged default
    })
  })
})
