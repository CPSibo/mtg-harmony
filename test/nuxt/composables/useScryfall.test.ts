import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import type { ScryfallCard } from '~/types/card'

// ─── Mock persistence and UI side effects ────────────────────────────────────

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: vi.fn(), load: vi.fn(() => null) })
})

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
})

// ─── Fixture ─────────────────────────────────────────────────────────────────

const mockScryfallCard: ScryfallCard = {
  id: 'test-scryfall-001',
  name: 'Lightning Bolt',
  mana_cost: '{R}',
  image_status: 'highres_scan',
  image_uris: { border_crop: 'https://example.com/lightning-bolt.jpg' },
  scryfall_uri: 'https://scryfall.com/card/test-001',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useScryfall', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = vi.fn()
    vi.stubGlobal('$fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ─── Initial state ──────────────────────────────────────────────────────────

  it('loading is false before fetch is called', () => {
    const { loading } = useScryfall()
    expect(loading.value).toBe(false)
  })

  it('card is null before fetch is called', () => {
    const { card } = useScryfall()
    expect(card.value).toBeNull()
  })

  it('error is null before fetch is called', () => {
    const { error } = useScryfall()
    expect(error.value).toBeNull()
  })

  // ─── Successful fetch ───────────────────────────────────────────────────────

  it('loading is true while the fetch is in-flight', async () => {
    let resolve!: (v: unknown) => void
    mockFetch.mockReturnValueOnce(new Promise(r => { resolve = r }))
    const { loading, fetch } = useScryfall()
    const promise = fetch()
    // fetch() is async — it sets loading=true then suspends at await $fetch().
    // Control returns here before the mock promise resolves.
    expect(loading.value).toBe(true)
    resolve(mockScryfallCard)
    await promise
  })

  it('loading returns to false after a successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockScryfallCard)
    const { loading, fetch } = useScryfall()
    await fetch()
    expect(loading.value).toBe(false)
  })

  it('onDeckStore.card is populated after a successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockScryfallCard)
    const { fetch } = useScryfall()
    await fetch()
    expect(useOnDeckStore().card).not.toBeNull()
    expect(useOnDeckStore().card?.name).toBe('Lightning Bolt')
  })

  it('a history entry is added after a successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockScryfallCard)
    const { fetch } = useScryfall()
    await fetch()
    const entries = useHistoryStore().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]!.cardName).toBe('Lightning Bolt')
    expect(entries[0]!.wasCast).toBe(false)
  })

  // ─── Error handling ─────────────────────────────────────────────────────────

  it('error ref is set when $fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    const { fetch, error } = useScryfall()
    await fetch()
    expect(error.value).toBeTruthy()
  })

  it('loading returns to false after a failed fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    const { fetch, loading } = useScryfall()
    await fetch()
    expect(loading.value).toBe(false)
  })

  it('error is cleared to null on a subsequent successful fetch', async () => {
    const { fetch, error } = useScryfall()
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    await fetch()
    expect(error.value).toBeTruthy() // sanity-check: error was set

    mockFetch.mockResolvedValueOnce(mockScryfallCard)
    await fetch()
    expect(error.value).toBeNull()
  })

  // ─── Prefetch queue ─────────────────────────────────────────────────────────

  describe('prefetch queue integration', () => {
    it('uses a queued card instead of calling $fetch', async () => {
      const prefetchStore = usePrefetchStore()
      prefetchStore.queue.push(mockScryfallCard)

      const { fetch } = useScryfall()
      await fetch()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(useOnDeckStore().card?.name).toBe('Lightning Bolt')
    })

    it('falls back to $fetch when the queue is empty', async () => {
      mockFetch.mockResolvedValueOnce(mockScryfallCard)
      const { fetch } = useScryfall()
      await fetch()
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('dequeues the card so the queue shrinks by one', async () => {
      const prefetchStore = usePrefetchStore()
      prefetchStore.queue.push(mockScryfallCard)
      prefetchStore.queue.push({ ...mockScryfallCard, id: 'second' })

      const { fetch } = useScryfall()
      await fetch()

      expect(prefetchStore.queue).toHaveLength(1)
    })

    it('adds a history entry when serving from the queue', async () => {
      const prefetchStore = usePrefetchStore()
      prefetchStore.queue.push(mockScryfallCard)

      const { fetch } = useScryfall()
      await fetch()

      const entries = useHistoryStore().entries
      expect(entries).toHaveLength(1)
      expect(entries[0]!.cardName).toBe('Lightning Bolt')
    })
  })

  // ─── No-image retry ─────────────────────────────────────────────────────────

  describe('no-image retry', () => {
    it('retries when the first response has no image and the retry succeeds', async () => {
      const imageless: ScryfallCard = { ...mockScryfallCard, image_status: 'missing', image_uris: undefined }
      mockFetch
        .mockResolvedValueOnce(imageless)
        .mockResolvedValueOnce(mockScryfallCard)

      const { fetch } = useScryfall()
      await fetch()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(useOnDeckStore().card?.name).toBe('Lightning Bolt')
    })

    it('surfaces an error when both the first response and the retry have no image', async () => {
      const imageless: ScryfallCard = { ...mockScryfallCard, image_status: 'missing', image_uris: undefined }
      mockFetch
        .mockResolvedValueOnce(imageless)
        .mockResolvedValueOnce(imageless)

      const { fetch, error } = useScryfall()
      await fetch()

      expect(error.value).toBeTruthy()
      expect(useOnDeckStore().card).toBeNull()
    })
  })
})
