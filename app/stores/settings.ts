import { defineStore } from 'pinia'
import type { AppSettings, SlotSize } from '~/types/card'

const STORAGE_KEY = 'mtg-settings'

const defaults: AppSettings = {
  slotSize: 'medium', // server-side / SSR fallback only
  gridDisplayMode: 'full',
  onDeckExpanded: true,
}

/**
 * Returns the appropriate slot size based on the device's viewport width.
 * Only meaningful on the client; falls back to 'medium' on the server.
 *
 * Breakpoints mirror Tailwind's md / lg:
 *   < 768px   → small  (mobile phones)
 *   768–1023px → medium (tablets)
 *   ≥ 1024px  → large  (laptops / desktops)
 */
function getDefaultSlotSize(): SlotSize {
  if (!import.meta.client) return defaults.slotSize
  if (window.innerWidth < 768) return 'small'
  if (window.innerWidth >= 1024) return 'large'
  return 'medium'
}

export const useSettingsStore = defineStore('settings', () => {
  const slotSize = ref<SlotSize>(getDefaultSlotSize())
  const gridDisplayMode = ref<'full' | 'compact'>(defaults.gridDisplayMode)
  const onDeckExpanded = ref<boolean>(defaults.onDeckExpanded)

  // Runtime-only: computed by CardGrid from container dimensions + slotSize.
  // Not persisted — recalculated on every mount / resize.
  const slotsPerPage = ref<number>(9)

  function setSlotSize(size: SlotSize) {
    slotSize.value = size
  }

  function setSlotsPerPage(n: number) {
    slotsPerPage.value = Math.max(1, n)
  }

  function setDisplayMode(mode: 'full' | 'compact') {
    gridDisplayMode.value = mode
  }

  function toggleOnDeckExpanded() {
    onDeckExpanded.value = !onDeckExpanded.value
  }

  function save() {
    const { save: persist } = useLocalStorage()
    persist(STORAGE_KEY, {
      slotSize: slotSize.value,
      gridDisplayMode: gridDisplayMode.value,
      onDeckExpanded: onDeckExpanded.value,
    })
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<AppSettings>(STORAGE_KEY)
    if (!data) {
      // First-time user: apply the correct default for this device now that
      // we're guaranteed to be on the client.
      slotSize.value = getDefaultSlotSize()
      return false
    }
    if (data.slotSize === 'small' || data.slotSize === 'medium' || data.slotSize === 'large') {
      slotSize.value = data.slotSize
    }
    if (data.gridDisplayMode === 'full' || data.gridDisplayMode === 'compact') {
      gridDisplayMode.value = data.gridDisplayMode
    }
    if (typeof data.onDeckExpanded === 'boolean') onDeckExpanded.value = data.onDeckExpanded
    return true
  }

  watch([slotSize, gridDisplayMode, onDeckExpanded], () => {
    save()
  })

  return {
    slotSize,
    slotsPerPage,
    gridDisplayMode,
    onDeckExpanded,
    setSlotSize,
    setSlotsPerPage,
    setDisplayMode,
    toggleOnDeckExpanded,
    save,
    load,
  }
})
