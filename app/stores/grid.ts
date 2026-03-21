import { defineStore, storeToRefs } from 'pinia'
import type { GridCard } from '~/types/card'

const STORAGE_KEY = 'mtg-grid'

export const useGridStore = defineStore('grid', () => {
  const settingsStore = useSettingsStore()
  const { slotsPerPage } = storeToRefs(settingsStore)

  const cards = ref<GridCard[]>([])
  const currentPage = ref<number>(0)

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(cards.value.length / slotsPerPage.value))
  )

  const pageCards = computed(() => {
    const start = currentPage.value * slotsPerPage.value
    return cards.value.slice(start, start + slotsPerPage.value)
  })

  function addCard(card: GridCard) {
    cards.value.push(card)
    currentPage.value = Math.floor((cards.value.length - 1) / slotsPerPage.value)
  }

  function removeCard(id: string) {
    const index = cards.value.findIndex(c => c.id === id)
    if (index === -1) return
    cards.value.splice(index, 1)
    if (currentPage.value > 0 && currentPage.value >= totalPages.value) {
      currentPage.value = totalPages.value - 1
    }
  }

  function duplicateCard(id: string) {
    const originalIndex = cards.value.findIndex(c => c.id === id)
    if (originalIndex === -1) return
    const original = cards.value[originalIndex]
    const copy: GridCard = {
      ...original,
      id: crypto.randomUUID(),
      instanceCount: 1,
      modifiers: [],
    }
    cards.value.splice(originalIndex + 1, 0, copy)
  }

  function updateCard(id: string, partial: Partial<GridCard>) {
    const card = cards.value.find(c => c.id === id)
    if (card) {
      Object.assign(card, partial)
    }
  }

  function clearAll() {
    cards.value = []
    currentPage.value = 0
  }

  function setPage(n: number) {
    currentPage.value = Math.max(0, Math.min(totalPages.value - 1, n))
  }

  function nextPage() {
    setPage(currentPage.value + 1)
  }

  function prevPage() {
    setPage(currentPage.value - 1)
  }

  function save() {
    const { save: persist } = useLocalStorage()
    persist(STORAGE_KEY, { cards: cards.value, currentPage: currentPage.value })
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<{ cards: GridCard[]; currentPage: number }>(STORAGE_KEY)
    if (!data) return false
    if (Array.isArray(data.cards)) cards.value = data.cards
    if (typeof data.currentPage === 'number') currentPage.value = data.currentPage
    return true
  }

  // Clamp currentPage whenever slotsPerPage changes (display-mode switch, resize, etc.)
  // so the visible page never overshoots the new totalPages.
  watch(slotsPerPage, () => {
    if (currentPage.value >= totalPages.value) {
      currentPage.value = Math.max(0, totalPages.value - 1)
    }
  })

  watch([cards, currentPage], () => {
    save()
  }, { deep: true })

  return {
    cards,
    currentPage,
    totalPages,
    pageCards,
    addCard,
    removeCard,
    duplicateCard,
    updateCard,
    clearAll,
    setPage,
    nextPage,
    prevPage,
    save,
    load,
  }
})
