import { parse, stringify } from 'flatted';

// Per-session flag: only show one save error toast per browser session
let _saveErrorShownThisSession = false;

export function useLocalStorage() {
  function save(key: string, value: unknown): void {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(key, stringify(value));
    } catch (ex) {
      if (!_saveErrorShownThisSession) {
        _saveErrorShownThisSession = true;
      }
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

  const saveDebounced = useDebounceFn(save, 200);

  return { save: saveDebounced, load };
}
