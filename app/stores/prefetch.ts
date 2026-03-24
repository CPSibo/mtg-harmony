import { defineStore } from 'pinia'
import type { ScryfallCard } from '~/types/card'

const STORAGE_KEY = 'mtg-prefetch'
const ENDPOINT = 'https://api.scryfall.com/cards/random?q=-t:land+game:paper'
const QUEUE_TARGET = 5
const FILL_THRESHOLD = 1

export const usePrefetchStore = defineStore('prefetch', () => {
  const settingsStore = useSettingsStore()

  const queue = ref<ScryfallCard[]>([])
  const prefetching = ref<boolean>(false)

  /** Remove and return the next card from the front of the queue, or null if empty. */
  function dequeue(): ScryfallCard | null {
    return queue.value.shift() ?? null
  }

  /**
   * Fetch cards in the background until the queue reaches QUEUE_TARGET.
   * Individual fetch failures are silently ignored so one bad response
   * does not block the rest of the fill run.
   */
  async function fill(): Promise<void> {
    if (!settingsStore.prefetchEnabled) return
    if (prefetching.value) return
    if (queue.value.length > FILL_THRESHOLD) return

    prefetching.value = true

    const needed = QUEUE_TARGET - queue.value.length
    for (let i = 0; i < needed; i++) {
      try {
        const card = await $fetch<ScryfallCard>(ENDPOINT)
        queue.value.push(card)
      } catch {
        // Silently ignore individual prefetch failures.
      }
    }

    prefetching.value = false

    // Re-check in case the queue was rapidly depleted while fill was in flight.
    if (settingsStore.prefetchEnabled && queue.value.length <= FILL_THRESHOLD) {
      void fill()
    }
  }

  /** Empty the queue (called by "Reset app"). */
  function clearQueue() {
    queue.value = []
  }

  function save() {
    const { save: persist } = useLocalStorage()
    persist(STORAGE_KEY, queue.value)
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage()
    const data = retrieve<ScryfallCard[]>(STORAGE_KEY)
    if (!data || !Array.isArray(data)) return false
    queue.value = data
    return true
  }

  // Trigger a refill whenever the queue drops to the threshold during normal use.
  watch(() => queue.value.length, (len) => {
    if (import.meta.client && settingsStore.prefetchEnabled && len <= FILL_THRESHOLD && !prefetching.value) {
      void fill()
    }
  })

  // Trigger a refill when the user re-enables prefetching from settings.
  watch(() => settingsStore.prefetchEnabled, (enabled) => {
    if (import.meta.client && enabled && queue.value.length <= FILL_THRESHOLD && !prefetching.value) {
      void fill()
    }
  })

  watch(queue, () => {
    save()
  }, { deep: true })

  return {
    queue,
    prefetching,
    dequeue,
    fill,
    clearQueue,
    save,
    load,
  }
})
