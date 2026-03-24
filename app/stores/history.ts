import { defineStore } from 'pinia'
import type { HistoryEntry } from '~/types/HistoryEntry'

const STORAGE_KEY = 'mtg-history'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])

  function addEntry(entry: HistoryEntry) {
    entries.value.push(entry)
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

  watch(entries, () => {
    save()
  }, { deep: true })

  return {
    entries,
    addEntry,
    markCast,
    clearAll,
    save,
    load,
  }
})
