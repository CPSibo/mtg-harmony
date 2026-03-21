import { defineStore } from 'pinia'
import type { AppSettings } from '~/types/card'

const STORAGE_KEY = 'mtg-settings'

const defaults: AppSettings = {
  slotsPerPage: 9,
  gridDisplayMode: 'full',
  onDeckExpanded: true,
}

export const useSettingsStore = defineStore('settings', () => {
  const slotsPerPage = ref<number>(defaults.slotsPerPage)
  const gridDisplayMode = ref<'full' | 'compact'>(defaults.gridDisplayMode)
  const onDeckExpanded = ref<boolean>(defaults.onDeckExpanded)

  function setSlotsPerPage(n: number) {
    slotsPerPage.value = Math.max(1, Math.min(100, n))
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
      slotsPerPage: slotsPerPage.value,
      gridDisplayMode: gridDisplayMode.value,
      onDeckExpanded: onDeckExpanded.value,
    })
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<AppSettings>(STORAGE_KEY)
    if (!data) return false
    if (typeof data.slotsPerPage === 'number') slotsPerPage.value = data.slotsPerPage
    if (data.gridDisplayMode === 'full' || data.gridDisplayMode === 'compact') {
      gridDisplayMode.value = data.gridDisplayMode
    }
    if (typeof data.onDeckExpanded === 'boolean') onDeckExpanded.value = data.onDeckExpanded
    return true
  }

  watch([slotsPerPage, gridDisplayMode, onDeckExpanded], () => {
    save()
  })

  return {
    slotsPerPage,
    gridDisplayMode,
    onDeckExpanded,
    setSlotsPerPage,
    setDisplayMode,
    toggleOnDeckExpanded,
    save,
    load,
  }
})
