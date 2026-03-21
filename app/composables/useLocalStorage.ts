// Per-session flag: only show one save error toast per browser session
let _saveErrorShownThisSession = false

export function useLocalStorage() {
  const toast = useToast()

  function save(key: string, value: unknown): void {
    if (!import.meta.client) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      if (!_saveErrorShownThisSession) {
        _saveErrorShownThisSession = true
        toast.add({
          title: 'Save Error',
          description: 'Could not save application state. Changes may not persist.',
          color: 'error',
        })
      }
    }
  }

  function load<T>(key: string): T | null {
    if (!import.meta.client) return null
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      toast.add({
        title: 'Load Error',
        description: `Could not load saved data for "${key}".`,
        color: 'error',
      })
      return null
    }
  }

  return { save, load }
}
