import { stringify, parse } from 'devalue';

// Per-session flag: only show one save error toast per browser session
let _saveErrorShownThisSession = false;

export function useLocalStorage() {
  function save(key: string, value: unknown): void {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(key, stringify(value));
    } catch (ex) {
      if (!_saveErrorShownThisSession) _saveErrorShownThisSession = true;
      console.error(
        'Could not save application state. Changes may not persist.',
        ex,
      );
    }
  }

  function load<T>(key: string): T | null {
    if (!import.meta.client) return null;
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
    if (!import.meta.client) return;
    try {
      localStorage.removeItem(key);
    } catch (ex) {
      console.error(`Could not remove saved data for "${key}".`, ex);
    }
  }

  const saveDebounced = useDebounceFn(save, 200);
  return { save: saveDebounced, load, remove };
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
