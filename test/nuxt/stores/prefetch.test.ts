import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

// ─── Mock persistence and UI side effects ────────────────────────────────────

const mockSave = vi.fn()
const mockLoad = vi.fn<() => unknown>(() => null)

mockNuxtImport('useLocalStorage', () => {
  return () => ({ save: mockSave, load: mockLoad })
})

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
})

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeScryfallCard(id = 'card-001') {
  return {
    id,
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    image_status: 'highres_scan' as const,
    image_uris: { border_crop: 'https://example.com/lightning-bolt.jpg' },
    scryfall_uri: `https://scryfall.com/card/${id}`,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePrefetchStore', () => {
  let store: ReturnType<typeof usePrefetchStore>
  let settings: ReturnType<typeof useSettingsStore>
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = vi.fn()
    vi.stubGlobal('$fetch', mockFetch)
    mockLoad.mockReturnValue(null)
    mockSave.mockClear()
    store = usePrefetchStore()
    settings = useSettingsStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ─── Initial state ──────────────────────────────────────────────────────

  it('starts with an empty queue', () => {
    expect(store.queue).toHaveLength(0)
  })

  it('starts with prefetching false', () => {
    expect(store.prefetching).toBe(false)
  })

  // ─── dequeue() ─────────────────────────────────────────────────────────

  describe('dequeue()', () => {
    it('returns null when the queue is empty', () => {
      expect(store.dequeue()).toBeNull()
    })

    it('returns and removes the first card in the queue', () => {
      const card = makeScryfallCard('a')
      store.queue.push(card)
      const result = store.dequeue()
      expect(result).toEqual(card)
      expect(store.queue).toHaveLength(0)
    })

    it('preserves remaining cards after dequeue', () => {
      store.queue.push(makeScryfallCard('a'))
      store.queue.push(makeScryfallCard('b'))
      store.dequeue()
      expect(store.queue).toHaveLength(1)
      expect(store.queue[0]!.id).toBe('b')
    })
  })

  // ─── fill() ────────────────────────────────────────────────────────────

  describe('fill()', () => {
    it('populates the queue to 5 cards when empty', async () => {
      mockFetch.mockResolvedValue(makeScryfallCard())
      await store.fill()
      expect(store.queue).toHaveLength(5)
    })

    it('calls $fetch exactly 5 times when queue is empty', async () => {
      mockFetch.mockResolvedValue(makeScryfallCard())
      await store.fill()
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('fills only the deficit when queue already has cards', async () => {
      store.queue.push(makeScryfallCard('existing'))
      mockFetch.mockResolvedValue(makeScryfallCard())
      await store.fill()
      // Started with 1, needed 4 more to reach target of 5.
      expect(mockFetch).toHaveBeenCalledTimes(4)
      expect(store.queue).toHaveLength(5)
    })

    it('is a no-op when prefetchEnabled is false', async () => {
      settings.setPrefetchEnabled(false)
      await store.fill()
      expect(mockFetch).not.toHaveBeenCalled()
      expect(store.queue).toHaveLength(0)
    })

    it('is a no-op when the queue is already above the fill threshold', async () => {
      // Push 2 cards (threshold is 1, so 2 > threshold)
      store.queue.push(makeScryfallCard('a'))
      store.queue.push(makeScryfallCard('b'))
      await store.fill()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('ignores individual fetch failures and continues filling', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(makeScryfallCard())
      await store.fill()
      // 5 attempts: 1 failure + 4 successes = 4 cards
      expect(store.queue).toHaveLength(4)
    })

    it('sets prefetching to false after completion', async () => {
      mockFetch.mockResolvedValue(makeScryfallCard())
      await store.fill()
      expect(store.prefetching).toBe(false)
    })

    it('is non-reentrant: a concurrent call while filling is a no-op', async () => {
      let resolveFirst!: () => void
      const firstCall = new Promise<ReturnType<typeof makeScryfallCard>>(r => {
        resolveFirst = () => r(makeScryfallCard())
      })
      mockFetch.mockReturnValueOnce(firstCall).mockResolvedValue(makeScryfallCard())

      // Start fill but do not await it — it suspends at the first $fetch.
      const fillPromise = store.fill()
      expect(store.prefetching).toBe(true)

      // A second call while prefetching is in progress should be rejected.
      await store.fill()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Now let the first fill complete.
      resolveFirst()
      await fillPromise
    })
  })

  // ─── clearQueue() ──────────────────────────────────────────────────────

  describe('clearQueue()', () => {
    it('empties the queue', () => {
      store.queue.push(makeScryfallCard('a'))
      store.queue.push(makeScryfallCard('b'))
      store.clearQueue()
      expect(store.queue).toHaveLength(0)
    })

    it('is a no-op on an already-empty queue', () => {
      store.clearQueue()
      expect(store.queue).toHaveLength(0)
    })
  })

  // ─── load() ────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns false and leaves the queue empty when there is no saved data', () => {
      mockLoad.mockReturnValue(null)
      expect(store.load()).toBe(false)
      expect(store.queue).toHaveLength(0)
    })

    it('returns true and hydrates the queue from saved data', () => {
      const saved = [makeScryfallCard('a'), makeScryfallCard('b')]
      mockLoad.mockReturnValue(saved)
      expect(store.load()).toBe(true)
      expect(store.queue).toHaveLength(2)
      expect(store.queue[0]!.id).toBe('a')
    })

    it('returns false when saved data is not an array', () => {
      mockLoad.mockReturnValue({ id: 'not-an-array' })
      expect(store.load()).toBe(false)
      expect(store.queue).toHaveLength(0)
    })
  })

  // ─── save() ────────────────────────────────────────────────────────────

  describe('save()', () => {
    it('calls persist with the current queue', () => {
      store.queue.push(makeScryfallCard('a'))
      store.save()
      expect(mockSave).toHaveBeenCalledWith('mtg-prefetch', store.queue)
    })
  })
})
