import type { ScryfallCard } from '~/types/card'

const SCRYFALL_ENDPOINT = 'https://api.scryfall.com/cards/random?q=-t:land+game:paper'

export function useScryfall() {
  const onDeckStore = useOnDeckStore()
  const historyStore = useHistoryStore()
  const toast = useToast()

  const card = ref<ScryfallCard | null>(null)
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT)
      card.value = response

      onDeckStore.setCard(response)

      historyStore.addEntry({
        id: crypto.randomUUID(),
        cardName: response.name,
        scryfall_uri: response.scryfall_uri,
        fetchedAt: new Date().toISOString(),
        wasCast: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching card'
      error.value = message
      toast.add({
        title: 'Fetch Error',
        description: `Could not fetch card: ${message}`,
        color: 'error',
      })
    } finally {
      loading.value = false
    }
  }

  return { card, loading, error, fetch }
}
