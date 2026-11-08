import { stringify, parse } from 'devalue';

const SAVE_DELAY_MS = 200;

/** Saves waiting for their debounce, by storage key. Shared by every caller. */
const pending = new Map<
  string,
  { value: unknown; timer: ReturnType<typeof setTimeout> }
>();

let saveErrorHandler: (() => void) | undefined;
let saveErrorReported = false;

/**
 * Sets what happens the first time a save fails (storage full or blocked).
 * Later failures in the same session are only logged.
 */
export function onSaveError(handler: () => void): void {
  saveErrorHandler = handler;
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, stringify(value));
  } catch (ex) {
    console.error(
      'Could not save application state. Changes may not persist.',
      ex,
    );
    if (!saveErrorReported) {
      saveErrorReported = true;
      saveErrorHandler?.();
    }
  }
}

/** Writes every pending save now, e.g. when the page is being hidden. */
export function flushSaves(): void {
  for (const [key, { value, timer }] of pending) {
    clearTimeout(timer);
    pending.delete(key);
    write(key, value);
  }
}

export function useLocalStorage() {
  /** Saves `value` under `key` once no newer save for that key arrives for 200 ms. */
  function save(key: string, value: unknown): void {
    clearTimeout(pending.get(key)?.timer);
    const timer = setTimeout(() => {
      pending.delete(key);
      write(key, value);
    }, SAVE_DELAY_MS);
    pending.set(key, { value, timer });
  }

  function load<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return parse(raw) as T;
    } catch (ex) {
      console.error(`Could not load saved data for "${key}".`, ex);
      return null;
    }
  }

  function remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (ex) {
      console.error(`Could not remove saved data for "${key}".`, ex);
    }
  }

  return { save, load, remove };
}

/**
 * Storage keys from features that no longer exist. Removed on startup so old
 * data doesn't linger in the browser.
 */
const RETIRED_STORAGE_KEYS = ['mtg-harmony_graveyard'];

/** Removes saved data left behind by retired features. */
export function removeRetiredStorage(): void {
  const { remove } = useLocalStorage();
  for (const key of RETIRED_STORAGE_KEYS) remove(key);
}
