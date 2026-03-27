import { defineStore } from 'pinia'
import type { GridCard } from '~/types/card'
import type { HistoryEntry } from '~/types/HistoryEntry'

const STORAGE_KEY = 'mtg-history'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])

  function addEntry(entry: HistoryEntry) {
    entries.value.push(entry)
  }

  /**
   * Adds the card associated with the given history entry to the grid and marks
   * the entry as cast. Does not affect the on-deck slot or add a new history entry.
   */
  function castFromHistory(id: string) {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return

    const gridStore = useGridStore()

    const card: GridCard = {
      id: randomUUID(),
      name: entry.cardName,
      mana_cost: entry.mana_cost,
      image_uri: entry.image_uri,
      scryfall_uri: entry.scryfall_uri,
      instanceCount: 1,
      modifiers: [],
      tapped: false,
    }

    gridStore.addCard(card)
    markCast(id)
  }

  function markCast(id: string) {
    const entry = entries.value.find(e => e.id === id)
    if (entry) {
      entry.wasCast = true
    }
  }

  function clearAll() {
    entries.value = []
  }

  function save() {
    const { save: persist } = useLocalStorage()
    persist(STORAGE_KEY, entries.value)
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<HistoryEntry[]>(STORAGE_KEY)
    if (!data || !Array.isArray(data)) return false
    entries.value = data
    return true
  }

  // Debounced to batch rapid successive adds (e.g. fast fetching) into a single
  // localStorage write rather than serialising the entire array on every push.
  watchDebounced(entries, () => {
    save()
  }, { deep: true, debounce: 200 })

  return {
    entries,
    addEntry,
    markCast,
    castFromHistory,
    clearAll,
    save,
    load,
  }
})
