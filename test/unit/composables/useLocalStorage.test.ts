import { describe, expect, it, vi } from 'vitest';
import {
  flushSaves,
  removeRetiredStorage,
  useLocalStorage,
} from '~/composables/useLocalStorage';
import { stubStorage } from '../fixtures/storage';

/** Saves through the debounced `save` and lets the debounce run out. */
function saveNow(key: string, value: unknown) {
  vi.useFakeTimers();
  useLocalStorage().save(key, value);
  vi.runAllTimers();
}

describe('useLocalStorage', () => {
  it('round-trips plain data', () => {
    const value = { name: 'Board', count: 3, tags: ['a', 'b'], empty: null };

    saveNow('key', value);

    expect(useLocalStorage().load('key')).toEqual(value);
  });

  it('round-trips Sets, Maps and Dates', () => {
    const value = {
      modifiers: new Set(['flying', 'trample']),
      lookup: new Map([['a', 1]]),
      fetchedAt: new Date('2026-01-02T03:04:05Z'),
    };

    saveNow('key', value);
    const loaded = useLocalStorage().load<typeof value>('key')!;

    expect(loaded.modifiers).toEqual(new Set(['flying', 'trample']));
    expect(loaded.lookup).toEqual(new Map([['a', 1]]));
    expect(loaded.fetchedAt).toEqual(new Date('2026-01-02T03:04:05Z'));
  });

  it('round-trips cyclic references', () => {
    type Node = { name: string; parent?: Node; children: Set<Node> };
    const parent: Node = { name: 'stack', children: new Set() };
    const child: Node = { name: 'card', parent, children: new Set() };
    parent.children.add(child);

    saveNow('key', parent);
    const loaded = useLocalStorage().load<Node>('key')!;

    const loadedChild = [...loaded.children][0]!;
    expect(loadedChild.name).toBe('card');
    expect(loadedChild.parent).toBe(loaded);
  });

  it('waits for the debounce before writing', () => {
    vi.useFakeTimers();
    const { save } = useLocalStorage();

    save('key', 1);
    expect(localStorage.getItem('key')).toBeNull();

    vi.advanceTimersByTime(200);
    expect(useLocalStorage().load('key')).toBe(1);
  });

  // #25: every useLocalStorage() call made its own debounce, so separate
  // saves never shared a timer.
  it('writes once, with the latest value, for a burst of saves', () => {
    vi.useFakeTimers();
    const setItem = stubStorage();

    for (let i = 1; i <= 3; i++) {
      useLocalStorage().save('key', i);
      vi.advanceTimersByTime(50);
    }
    vi.runAllTimers();

    expect(setItem).toHaveBeenCalledOnce();
    expect(useLocalStorage().load('key')).toBe(3);
  });

  it('debounces each key on its own', () => {
    vi.useFakeTimers();

    useLocalStorage().save('a', 1);
    useLocalStorage().save('b', 2);
    vi.runAllTimers();

    expect(useLocalStorage().load('a')).toBe(1);
    expect(useLocalStorage().load('b')).toBe(2);
  });

  it('writes pending saves at once when flushed', () => {
    vi.useFakeTimers();
    const setItem = stubStorage();
    useLocalStorage().save('key', 1);

    flushSaves();

    expect(useLocalStorage().load('key')).toBe(1);
    vi.runAllTimers();
    expect(setItem).toHaveBeenCalledOnce();
  });

  it('reports the first failed save to the error handler, once', async () => {
    vi.resetModules();
    const { onSaveError, useLocalStorage: fresh } =
      await import('~/composables/useLocalStorage');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubStorage(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const handler = vi.fn();
    onSaveError(handler);
    vi.useFakeTimers();

    fresh().save('a', 1);
    vi.runAllTimers();
    fresh().save('b', 2);
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns null for a missing key', () => {
    expect(useLocalStorage().load('missing')).toBeNull();
  });

  it('returns null and logs for data it cannot parse', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('key', '{not devalue');

    expect(useLocalStorage().load('key')).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });

  it('logs instead of throwing when storage is full', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = stubStorage(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => saveNow('key', 1)).not.toThrow();
    expect(setItem).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('removes a key', () => {
    localStorage.setItem('key', '1');

    useLocalStorage().remove('key');

    expect(localStorage.getItem('key')).toBeNull();
  });

  it('removes data left behind by retired features', () => {
    localStorage.setItem('mtg-harmony_graveyard', '[]');
    localStorage.setItem('mtg-harmony_battlefield', '[]');

    removeRetiredStorage();

    expect(localStorage.getItem('mtg-harmony_graveyard')).toBeNull();
    expect(localStorage.getItem('mtg-harmony_battlefield')).toBe('[]');
  });
});
