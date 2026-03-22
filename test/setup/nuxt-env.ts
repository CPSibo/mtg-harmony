// Replace happy-dom's localStorage with a fully callable in-memory stub.
// @nuxtjs/color-mode's client plugin calls window.localStorage.setItem()
// synchronously (via an immediate watcher) during Nuxt app initialisation.
// happy-dom's Storage methods are not callable in the way the plugin expects,
// producing a TypeError that pollutes stderr without failing any test.
// This setupFiles module runs before any test code, so the stub is in place
// by the time the first composable call triggers Nuxt to boot and run plugins.
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => { store[key] = String(value) },
    removeItem: (key: string): void => { delete store[key] },
    clear: (): void => { store = {} },
    get length(): number { return Object.keys(store).length },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
