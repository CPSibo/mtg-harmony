import type { ScryfallCard } from '~/types/card'
import { hasUsableImage, pickImageUri } from '~/utils/scryfallImage'

const SCRYFALL_ENDPOINT = 'https://api.scryfall.com/cards/random?q=-t:land+game:paper'

export function useScryfall() {
  const onDeckStore = useOnDeckStore()
  const historyStore = useHistoryStore()
  const prefetchStore = usePrefetchStore()
  const toast = useToast()

  const card = ref<ScryfallCard | null>(null)
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const queued = prefetchStore.dequeue()
      let response = queued ?? await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT)

      // Retry once if the card has no usable image (e.g. image_status 'missing').
      if (!hasUsableImage(response)) {
        response = await $fetch<ScryfallCard>(SCRYFALL_ENDPOINT)
        if (!hasUsableImage(response)) {
          throw new Error('Fetched card has no image')
        }
      }

      card.value = response

      onDeckStore.setCard(response)

      historyStore.addEntry({
        id: randomUUID(),
        cardName: response.name,
        mana_cost: response.mana_cost,
        image_uri: pickImageUri(response) ?? '',
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
