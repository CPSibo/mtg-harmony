# CLAUDE.md — MTG Discord Helper

## Purpose

A mobile-friendly browser app that acts as a scratchpad for tracking Magic: The Gathering cards during a game session. It draws a random card from Scryfall, lets the user cast it onto a grid, and tracks per-card state (instance count, keyword/counter modifiers). A history modal shows previously fetched cards. All state is persisted to `localStorage`; there is no backend.

## Stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 (SSR disabled — client-only) |
| UI | Nuxt UI 4 (Tailwind CSS v4 via `@nuxt/ui`) |
| State | Pinia (setup-store style) |
| Utilities | VueUse (`@vueuse/nuxt`) |
| Icons | Lucide (via `@iconify-json/lucide`), Mana font (`mana-font`), Keyrune (`keyrune`) |
| Testing | Vitest 4, `@nuxt/test-utils`, `@vue/test-utils` |
| Language | TypeScript throughout |

### Key directories

```
src/
  app/
    components/
      CardGrid/          # Grid of cast cards (auto-fit columns/rows)
      OnDeckSlot/        # Single card drawn from Scryfall, ready to cast
      HamburgerMenu/     # Settings modal (slot size, display mode, clear grid)
      HistoryModal/      # Log of all fetched cards + cast status
      shared/            # SharedConfirmDialog, SharedModifierPickerDialog
    composables/
      useLocalStorage.ts # JSON persistence wrapper around localStorage
      useScryfall.ts     # Scryfall random-card fetch with loading/error state
    pages/
      index.vue          # Single page: OnDeckSlot + CardGrid
    stores/
      grid.ts            # Cards on the grid; pagination
      settings.ts        # Slot size, display mode, onDeckExpanded
      history.ts         # Fetch history with wasCast flag
      onDeck.ts          # Card currently on deck; castCard() integration
    types/
      card.ts            # ScryfallCard, GridCard, Modifier, HistoryEntry, SlotSize
  test/
    unit/                # Pure Node environment (vitest project: unit)
    nuxt/                # Nuxt + happy-dom environment (vitest project: nuxt)
      stores/            # Store-level unit tests
      components/        # Component-level unit tests
      composables/       # Composable unit tests (e.g. useScryfall)
    e2e/                 # Playwright end-to-end tests (real browser)
```

## Commands

All commands must be run from the `src/` directory.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Nuxt dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run `vue-tsc` type checking |
| `npm run lint` | Run ESLint across the project |
| `npm run test` | Run all tests (both `unit` and `nuxt` Vitest projects) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests and emit a v8 coverage report |
| `npm run test:unit` | Run only the Node-environment unit tests |
| `npm run test:nuxt` | Run only the Nuxt-environment store/component tests |
| `npm run test:e2e` | Run Playwright end-to-end tests (starts dev server automatically) |
| `npm run test:e2e:ui` | Run Playwright tests in interactive UI mode |

## Code style

### General

- **TypeScript everywhere.** No `any` except inside test helpers where a cast is justified and commented.
- **`<script setup lang="ts">`** for all Vue components. Options API is not used.
- Prefer `const` over `let`; never use `var`.
- Arrow functions for callbacks; named `function` declarations for top-level composables and store actions.
- Explicit return types on exported functions; infer types elsewhere where unambiguous.
- Comments should be complete sentences, with punctuation, except when they're exceptionally short.
- Functions, classes, and types should use standard doc block comments.

### Vue components

- One component per file; filename matches the exported component name.
- Auto-imported composables and stores — do not add explicit imports for Nuxt auto-imports (`ref`, `computed`, `useGridStore`, etc.).
- Props defined with `defineProps<{ ... }>()`, emits with `defineEmits<{ ... }>()`.
- Template expressions are kept simple; extract logic into `computed` or helper functions in `<script setup>`.
- Use `@click.stop` / `@contextmenu.prevent` at the point of the handler, not in a wrapper.

### Pinia stores

- All stores use the **setup-store** style (`defineStore('id', () => { ... })`).
- Expose only what callers need in the `return` object; keep internal helpers private.
- Persistence is handled by the `useLocalStorage()` composable — `save()` / `load()` methods are declared in every store and wired to a `watch` for auto-save.

### Styling

- **Tailwind utility classes only.** No `<style>` blocks and no custom CSS unless adding a CSS variable to `app/assets/css/main.css`.
- Dark mode via the `dark:` variant (Tailwind's `class` strategy, managed by Nuxt UI).
- Semantic Nuxt UI components (`UButton`, `UIcon`, etc.) for interactive elements; raw `<button>` only for custom-positioned or tightly-constrained UI (e.g. modifier chips, context menu items).
- Modal/overlay components use `<Teleport to="body">` to escape `overflow-hidden` parents.

### Testing

- **Store tests** live under `test/nuxt/stores/` (Nuxt + happy-dom environment).
- **Component tests** live under `test/nuxt/components/` (same Nuxt + happy-dom environment). Use `mountSuspended` from `@nuxt/test-utils/runtime`.
- **Composable tests** live under `test/nuxt/composables/`. Mock `$fetch` with `vi.stubGlobal('$fetch', vi.fn())` and restore with `vi.unstubAllGlobals()` in `afterEach`.
- **E2E tests** live under `test/e2e/` and run via Playwright (`npm run test:e2e`). Use `page.route('**/api.scryfall.com/**', ...)` to intercept Scryfall API calls. E2E tests are intentionally excluded from `npm run test` — they require a running dev server and form a separate CI stage.
- Mock `useLocalStorage` at the top of each Vitest file with `mockNuxtImport` to prevent side-effects on `localStorage` and `useToast`.
- Store tests reset Pinia state with `setActivePinia(createPinia())` in `beforeEach`. Component tests that depend on stores use the **mount-first pattern**: mount the component first, then call `useXxxStore()` after mounting (so it returns the Nuxt app's Pinia instance), then set up state and `await nextTick()` before asserting. Clean up with `useXxxStore().clearAll()` in `afterEach`.
- Teleported content (`<Teleport to="body">`) is not accessible via `wrapper.find()`. Query it via `document.body.querySelector()` instead.
- Test descriptions use plain English: `'addCard appends a card'`, not `'should append a card'`.
- One logical assertion per `it` block where practical; group related boundary cases in a nested `describe`.

## Technical decisions

| Decision | What | Why |
|---|---|---|
| `scripts/patch-deps.mjs` postinstall patch | `package.json` chains `node scripts/patch-deps.mjs` after `nuxt prepare` in the `postinstall` script. The script replaces `from 'vitest/environments'` with `from 'vitest/runtime'` in `@nuxt/test-utils/dist/vitest-environment.mjs`. | Vitest 4.1 deprecated `vitest/environments` and moved `populateGlobal` to `vitest/runtime`. `@nuxt/test-utils` 4.0.0 (current latest) still imports from the old path, producing a deprecation warning on every test run. The patch is idempotent — it no-ops once the upstream package is updated. |
| `vue-router` pinned in `overrides` + `devDependencies` | `package.json` pins `vue-router@5.0.3` in both `overrides` and `devDependencies`. | Nuxt 4 installs vue-router nested under `nuxt/node_modules/` rather than hoisting it. `@vue/language-core` auto-registers it as a Volar plugin via a bare `require('vue-router/volar/sfc-route-blocks')`, which fails unless the package is reachable at the top level. The explicit `devDependency` forces hoisting; the `override` pins the version and suppresses `@nuxt/ui`'s optional peer-dep conflict against vue-router v4. |
| Object-style `defineEmits` | All components use the Vue 3.3 object syntax (`{ eventName: [arg: Type] }`) rather than the overload call signature syntax (`(e: 'name', arg: Type): void`). | TypeScript cannot distribute overloaded call signatures over a union type, so `emit(unionVar)` produces a TS2769 error with the overload style. The object style avoids generating overloads and resolves cleanly. |
| `<Teleport to="body">` for all modals | `SharedConfirmDialog`, `SharedModifierPickerDialog`, and `CardGridContextMenu` are teleported to `<body>`. | Card grid slots use `overflow-hidden` for image containment. Any modal rendered inside a slot would be clipped. Teleporting to `<body>` guarantees modals are never clipped regardless of their position in the component tree. |
| `useEventListener` for ESC / outside-click | Dialogs and the context menu close on ESC via `useEventListener(document, 'keydown', ...)` and on outside-click via `onClickOutside`. | Using VueUse's helpers rather than `addEventListener` / `removeEventListener` directly ensures the listeners are automatically removed when the component is unmounted, with no manual cleanup. |
| Playwright `webServer` config | `playwright.config.ts` uses `webServer: { command: 'npm run dev', reuseExistingServer: !process.env.CI }`. | Playwright needs a running Nuxt dev server. The `reuseExistingServer` flag avoids starting a second server when a dev server is already running locally, while still spawning a fresh one in CI. E2E tests are kept out of `npm run test` (Vitest only) to avoid requiring a dev server for the standard test run. |

## Quality checks

Run the following before concluding any increment of work:

```bash
# From src/
npm run typecheck   # no type errors
npm run lint        # no lint errors or warnings
npm run test        # all tests pass
npm run test:e2e    # all tests pass
```

All three must exit cleanly (exit code 0) before a task is considered complete. If a lint rule or type error is introduced by new code, fix it in the same increment — do not suppress errors with `// eslint-disable` or `// @ts-ignore` unless there is a documented external constraint.

If a non-obvious workaround is required to keep the checks passing (a dependency override, a type assertion, a structural change made for TypeScript's benefit rather than the app's), add a row to the **Technical decisions** table explaining what was done and why.
