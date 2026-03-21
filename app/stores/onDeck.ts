import { defineStore } from 'pinia'
import type { GridCard, ScryfallCard } from '~/types/card'

const STORAGE_KEY = 'mtg-ondeck'

export const useOnDeckStore = defineStore('onDeck', () => {
  const card = ref<GridCard | null>(null)

  function setCard(scryfallCard: ScryfallCard) {
    card.value = {
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      image_uri: scryfallCard.image_uris.normal,
      scryfall_uri: scryfallCard.scryfall_uri,
      instanceCount: 1,
      modifiers: [],
    }
  }

  function castCard() {
    if (!card.value) return

    const gridStore = useGridStore()
    const historyStore = useHistoryStore()

    // Find the most recent uncast history entry matching this card
    const historyEntry = historyStore.entries
      .slice()
      .reverse()
      .find(e => e.scryfall_uri === card.value!.scryfall_uri && !e.wasCast)

    if (historyEntry) {
      historyStore.markCast(historyEntry.id)
    }

    gridStore.addCard({ ...card.value })
    card.value = null
  }

  function clearCard() {
    card.value = null
  }

  function save() {
    const { save: persist } = useLocalStorage()
    persist(STORAGE_KEY, card.value)
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<GridCard | null>(STORAGE_KEY)
    if (data === null) return false
    card.value = data
    return true
  }

  watch(card, () => {
    save()
  }, { deep: true })

  return {
    card,
    setCard,
    castCard,
    clearCard,
    save,
    load,
  }
})
