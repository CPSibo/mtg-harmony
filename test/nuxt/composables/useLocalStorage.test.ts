import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

// ─── Mock UI side effects ──────────────────────────────────────────────────────
// Capture the toast.add spy so individual tests can assert on it.

const mockToastAdd = vi.fn()

mockNuxtImport('useToast', () => {
  return () => ({ add: mockToastAdd })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    mockToastAdd.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── save() ─────────────────────────────────────────────────────────────────

  describe('save()', () => {
    it('serializes the value to JSON and writes it to localStorage', () => {
      const { save } = useLocalStorage()
      save('my-key', { x: 1 })
      expect(localStorage.getItem('my-key')).toBe('{"x":1}')
    })

    it('overwrites an existing key with the new value', () => {
      const { save } = useLocalStorage()
      save('my-key', 'first')
      save('my-key', 'second')
      expect(localStorage.getItem('my-key')).toBe('"second"')
    })

    // The _saveErrorShownThisSession flag is module-level and starts false.
    // Vitest isolates modules per-file, so this test always runs with the flag
    // in its initial state provided no earlier test in this file triggers a save
    // error (none do, by design).
    it('shows a toast at most once when localStorage.setItem throws', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      const { save } = useLocalStorage()
      save('a', 1) // first failure → toast shown, flag set to true
      save('b', 2) // second failure → flag already true, toast suppressed
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'error' }),
      )
    })
  })

  // ─── load() ─────────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns null when the key does not exist', () => {
      const { load } = useLocalStorage()
      expect(load('missing')).toBeNull()
    })

    it('returns the deserialized value for an existing key', () => {
      const { save, load } = useLocalStorage()
      save('my-key', { name: 'Lightning Bolt', count: 3 })
      expect(load('my-key')).toEqual({ name: 'Lightning Bolt', count: 3 })
    })

    it('round-trips an array value correctly', () => {
      const { save, load } = useLocalStorage()
      const arr = [1, 'two', { three: 3 }]
      save('arr-key', arr)
      expect(load('arr-key')).toEqual(arr)
    })

    it('returns null and shows a toast when the stored value is invalid JSON', () => {
      localStorage.setItem('bad-key', 'not}{valid[json')
      const { load } = useLocalStorage()
      expect(load('bad-key')).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'error' }),
      )
    })
  })
})
