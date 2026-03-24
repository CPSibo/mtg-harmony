import { describe, it, expect } from 'vitest'
import { randomUUID } from '../../app/utils/randomUUID'

// RFC 4122 §4.4 UUID v4 pattern.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('randomUUID', () => {
  // ─── Output format ───────────────────────────────────────────────────────────

  it('returns a string matching the UUID v4 format', () => {
    expect(randomUUID()).toMatch(UUID_V4_REGEX)
  })

  it('returns a distinct value on each call', () => {
    expect(randomUUID()).not.toBe(randomUUID())
  })

  // ─── Native path ─────────────────────────────────────────────────────────────

  it('delegates to the native crypto.randomUUID when it is available', () => {
    const fixed = '00000000-0000-4000-8000-000000000000' as ReturnType<typeof crypto.randomUUID>
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: () => fixed, configurable: true, writable: true })
    try {
      expect(randomUUID()).toBe(fixed)
    }
    finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true, writable: true })
    }
  })

  // ─── Fallback path ───────────────────────────────────────────────────────────

  it('falls back to getRandomValues and still returns a valid UUID v4 when crypto.randomUUID is undefined', () => {
    const original = crypto.randomUUID
    // @ts-expect-error — deliberately clearing to exercise the getRandomValues fallback branch
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true })
    try {
      expect(randomUUID()).toMatch(UUID_V4_REGEX)
    }
    finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true, writable: true })
    }
  })
})
