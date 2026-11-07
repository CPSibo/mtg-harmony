import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from '~/utils/randomUUID';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', () => {
  it('returns distinct v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomUUID()));

    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('falls back to getRandomValues outside secure contexts', () => {
    // Plain HTTP (a dev server opened from a phone) has no randomUUID.
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    expect(randomUUID()).toMatch(UUID_V4);
  });
});
