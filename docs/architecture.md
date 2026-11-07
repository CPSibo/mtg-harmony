# Architecture

How MTG Harmony is put together. Start here before changing code. The words the code uses for game concepts are
defined in [domain.md](domain.md).

## Shape of the app

A single-page, client-only Vue 3 app built with Vite. There is no server and no router. All state lives in Pinia
stores and is saved to `localStorage`. Cloudflare Pages serves the static build from `dist/`.

| Piece       | Choice                                                                                  |
| ----------- | --------------------------------------------------------------------------------------- |
| Framework   | Vue 3 (`<script setup>`, TypeScript), mounted from `app/main.ts` into `index.html`      |
| UI kit      | Nuxt UI through its Vite plugin, with no auto-imports, component registration or router |
| State       | Pinia setup stores                                                                      |
| Utilities   | VueUse                                                                                  |
| Styling     | Tailwind v4 (`app/assets/css/main.css`), `mana-font` for mana and ability symbols       |
| Card data   | The [Scryfall API](https://scryfall.com/docs/api), called directly from the browser     |
| Persistence | `localStorage`, serialized with [devalue](https://github.com/Rich-Harris/devalue)       |

Every component, composable and Vue API is imported explicitly. `~` points to `app/`. See `AGENTS.md` for the
import gotchas (`UIcon`, `$fetch`).

`App.vue` is the whole page: the board, the corner buttons, the command palette, the Add Card window, and the
confirmation dialogs. Settings and the confirmation dialogs are loaded lazily with `defineAsyncComponent`.

## Folder layout

```text
app/
  features/        Vertical slices: each owns its store, components and widget
    addCard/       Manual card search (store, window, widget)
    battlefield/   The board's state: stacks, z-order, attaching, save/load
    discordFetcher/ Random-card fetching and the On-deck panel
    palette/       The command palette
    widgets/       The widget registry that feeds the palette and keyboard shortcuts
  components/      Shared and layout components: the board, cards, corner buttons, dialogs
  composables/     useScryfall, useLocalStorage, usePanAndZoom, useScaledDraggable, useReset
  stores/          App-wide stores: settings, inputMode
  types/           PlayArea (the board model), Scryfall, MtgConcepts (the modifier list)
public/            Served as-is: favicon, og-image.png (the social preview)
scripts/og-image/  Source of og-image.png. Edit og-image.html, then `npm run og-image`
```

A feature exports its public surface from its `index.ts`. Import from the feature (`~/features/battlefield`), not
from files inside it.

## Widgets, commands and the palette

A **widget** is how a feature contributes to the shared UI. It is a plain object (`WidgetDefinition` in
`features/widgets/types.ts`) with commands and, optionally, settings:

```ts
{
  id: 'addCard',
  label: 'Add Card',
  icon: 'i-lucide-plus',
  commands: [
    { id: 'addCard.open', label: 'Add card to battlefield', icon: 'i-lucide-plus', kbds: 'b-a', execute: … },
  ],
}
```

The flow:

1. A feature builds its widget from its store (`createAddCardWidget(store)`).
2. A small component (`AddCardWidgetComponent.vue`) registers it with `useWidgetRegistry()` on mount and
   unregisters it on unmount.
3. `register()` binds each command's `kbds` with Nuxt UI's `defineShortcuts`. Chords use a dash: `b-a` means "b,
   then a".
4. The registry's `paletteGroups` turns every widget into a group of `UCommandPalette` items. The palette
   (`features/palette/components/FloatingBar.vue`) opens with `/` or the search button at the top of the screen.

Today only Add Card registers a widget. The registry also exposes `allSettings`, but the settings dialog doesn't
read it yet: it binds to the settings store directly.

## Stores and persistence

Each persisted store follows the same pattern:

```ts
const STORAGE_KEY = 'mtg-harmony_<name>';

function save() { useLocalStorage().save(STORAGE_KEY, { …state }); }
function load(): boolean { const data = useLocalStorage().load(STORAGE_KEY); … validate each field … }

load();                          // On creation
watch([…state], save, { deep }); // On every change
```

- `load()` checks every field's type before using it, so stale or hand-edited storage can't break the app.
- Stores build their defaults from a `createDefaults()` factory where the defaults hold objects or arrays, so no
  two store instances share them.
- `reset()` returns a store to its defaults. `useReset()` chains these into the menu's three levels: **clear
  board** (battlefield), **clear session** (plus the fetcher's history) and **reset all data** (plus settings).

| Key                          | Store                    | Holds                                              |
| ---------------------------- | ------------------------ | -------------------------------------------------- |
| `mtg-harmony_battlefield`    | `useBattlefieldStore`    | Stacks, z-order, board centre, snap size           |
| `mtg-harmony_discordFetcher` | `useDiscordFetcherStore` | Every fetched card, the current position, settings |
| `mtg-harmony_settings`       | `useSettingsStore`       | App settings                                       |
| `mtg-harmony_inputMode`      | `useInputModeStore`      | Last input mode (touch or cursor)                  |

`useLocalStorage` serializes with **devalue**, not JSON, because the board model has `Set`s and cycles: a card
points to its stack (`BoardCard.stack`), and the stack points back to the card. devalue keeps both, so a loaded
board has the same object graph it was saved with.

Retired keys are listed in `RETIRED_STORAGE_KEYS` and deleted on startup (`removeRetiredStorage()` in `App.vue`).
Until v1 there are no users to protect, so a key or stored shape can change without migrating old saves.

Saves are debounced per key: a burst of changes writes once, 200 ms after the last one, with the latest state.
`App.vue` writes any pending saves straight away when the page is hidden (`pagehide`, `visibilitychange`), so the
last change isn't lost when a phone kills the tab. If a write fails, the error is logged and the first failure in
a session shows a toast.

## The board

`components/playArea/Board.vue` renders a fixed 5000 × 5000 px canvas inside a full-screen wrapper. The canvas is
moved and scaled with a single CSS `transform`.

### Pan and zoom (`usePanAndZoom`)

- Mouse: drag to pan, wheel to zoom around the cursor. Trackpad pinch arrives as a wheel event with `ctrlKey`.
- Touch: one finger pans, two fingers pinch-zoom around their midpoint. Lifting one finger mid-pinch resumes the
  pan with the other.
- Position and scale are clamped so the canvas always fills the window. Scale is capped at 3.
- When a pan ends, the visible centre is written to the battlefield store, and new stacks appear there. It isn't
  written on every frame: that was too slow.
- Pan and zoom are disabled while attaching, and so is stack dragging.

### Dragging stacks (`useScaledDraggable`)

Each stack (`BoardCardStack.vue`) wraps VueUse's `useDraggable`. The wrapper divides pointer movement by the
board's scale, snaps to `snapScale` and clamps the stack inside the canvas. On drop it calls
`battlefield.setStackPosition()`. While a stack is dragged, the board's own touch handling stands down
(`anyCardIsDragging`).

### Z-order

`battlefield.zOrder` is a list of stack IDs, front last. `orderedStacks` sorts a copy of `stacks` by it, so
rendering order changes without reordering the stacks themselves. Dragging a stack calls `bringToFront()`.
`load()` reconciles the saved order with the saved stacks: unknown IDs are dropped, and missing stacks are added
at the front.

### Input mode

`useInputModeStore` tracks whether the last pointer was a finger or a mouse, from `pointerdown` and `pointermove`
on `window`. Components use `isTouch` / `isCursor` to adapt, such as showing stack actions without hover. With no
saved mode, it guesses from `(pointer: coarse)`.

## Data model

The model is in `types/PlayArea.ts`; the terms are defined in [domain.md](domain.md).

- `Battlefield` holds `stacks`, `zOrder`, `center` and `snapScale`.
- A `BoardCardStack` has an `id`, a `position`, one `primary` card, and two `Set`s: `attachments` and `unders`.
- A `BoardCard` holds its Scryfall data, `tapped`, `faceNumber` (a big number shown on the card; 0 hides it), a
  `Set` of `modifiers`, and a back-reference to its `stack`.
- A `BoardCardModifier` is one entry from `MODIFIERS` (`types/MtgConcepts.ts`) with a count.

Rules the battlefield store enforces:

- Every card on the board is in exactly one stack. Attaching moves the card out of its old stack first. A stack
  left without its primary explodes, and each remaining card becomes its own stack.
- A card can't be attached to itself, or to a stack it's already in.
- Only a stack's primary card is a valid attachment target.
- Every card is its own instance. `createBoardCard` builds one from Scryfall data with a fresh ID, and the
  Scryfall ID stays on `scryfallInfo.id`. Casting from On-deck or Add Card goes through `castCard`, which puts a
  new instance on the board, so casting the same card twice gives two independent cards. The On-deck history card
  never goes on the board itself.
- Card and stack IDs come from `randomUUID` (`utils/randomUUID.ts`). It falls back to `crypto.getRandomValues`
  where `crypto.randomUUID` is missing, as on a plain-HTTP dev server opened from a phone.

## Scryfall

All calls go straight from the browser to `api.scryfall.com`. There is no proxy or API key.

| Use              | Endpoint                                              | Where                                    |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- |
| On-deck fetching | `GET /cards/random?q=-t:land+game:paper`              | `useScryfall` → `useDiscordFetcherStore` |
| Add Card search  | `GET /cards/search?q=…` (debounced 500 ms, cancelled) | `AddCardWindow.vue`                      |

- **Rate limiting** (`useScryfall`): requests are spaced at least 600 ms apart, shared across all callers.
  Scryfall allows about 2 per second. A 429 waits out Scryfall's 30-second cooldown once; a second 429 stops the
  batch.
- **Images**: a fetched card without a usable image is retried once, then skipped. `pickImageUri()` prefers
  `border_crop`, then `normal`, then `small`.
- **Look-ahead**: the fetcher fetches in batches of 10 and keeps the whole history, so "previous" works. `next()`
  resolves as soon as the next card arrives, while the rest of the batch keeps loading. When fewer than 3 unseen
  cards are left, it tops up in the background. Overlapping fetches share one request. The next card's image is
  preloaded.

## Gotchas

- **Touch listeners in `Board.vue` are added imperatively.** Vue's `@touchstart.stop.prevent` modifiers compile
  to a bubble-phase listener that calls `stopPropagation()`. That races with the capture-phase listeners `useDraggable` puts
  on stacks, and breaks either board panning or card taps at random. The board adds `{ passive: false }`
  listeners itself, so it can `preventDefault()` without stopping propagation. `touchend` stays passive and isn't
  prevented, so the browser still turns taps into clicks on buttons.
- **The board wrapper is `touch-action: none`** (Tailwind's `touch-none`), so the browser doesn't pan or zoom the
  page under it. iOS Safari still misbehaves in places (#58), and its edge-swipe navigation can't be blocked from
  a page (#59).
- **The mount element keeps `class="isolate"`** (`index.html`). Nuxt UI's overlays rely on it for stacking.
- **Board card sizes are CSS variables** (`--card-short-side`, `--card-long-side` in `main.css`), scaled per
  stack. Layout maths for attachments lives in `BoardCardStack.vue`'s styles.

## Tests

Unit tests (Vitest, `test/unit/`) cover the stores and `useLocalStorage`. End-to-end tests (Playwright,
`test/e2e/`) run against the production build with Scryfall mocked. Conventions are in `AGENTS.md`.
