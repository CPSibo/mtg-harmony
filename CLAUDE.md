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

- Test files live under `test/nuxt/stores/` for Pinia store tests (Nuxt + happy-dom environment).
- Mock `useLocalStorage` at the top of each test file with `mockNuxtImport` to prevent side-effects on `localStorage` and `useToast`.
- Each `describe` block resets Pinia state with `setActivePinia(createPinia())` in `beforeEach`.
- Test descriptions use plain English: `'addCard appends a card'`, not `'should append a card'`.
- One logical assertion per `it` block where practical; group related boundary cases in a nested `describe`.

## Quality checks

Run the following before concluding any increment of work:

```bash
# From src/
npm run typecheck   # no type errors
npm run lint        # no lint errors or warnings
npm run test        # all tests pass
```

All three must exit cleanly (exit code 0) before a task is considered complete. If a lint rule or type error is introduced by new code, fix it in the same increment — do not suppress errors with `// eslint-disable` or `// @ts-ignore` unless there is a documented external constraint.
