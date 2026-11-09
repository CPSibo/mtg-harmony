# Architecture

How MTG Harmony is put together. Start here before changing code. The words the code uses for game concepts are
defined in [domain.md](domain.md).

## Shape of the app

A single-page, client-only Vue 3 app built with Vite. There is no server and no router. All state lives in Pinia
stores and is saved to `localStorage`. Cloudflare Pages serves the static build from `dist/`.

| Piece       | Choice                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | Vue 3 (`<script setup>`, TypeScript), mounted from `app/main.ts` into `index.html`                                                                         |
| UI kit      | Nuxt UI through its Vite plugin, with no auto-imports, component registration or router                                                                    |
| State       | Pinia setup stores                                                                                                                                         |
| Utilities   | VueUse                                                                                                                                                     |
| Styling     | Tailwind v4 (`app/assets/css/main.css`), a `mana-font` subset (`npm run fonts:mana`)                                                                       |
| Card data   | The [Scryfall API](https://scryfall.com/docs/api), called directly from the browser                                                                        |
| Persistence | `localStorage`, serialized with [devalue](https://github.com/Rich-Harris/devalue); past games in IndexedDB via [idb](https://github.com/jakearchibald/idb) |

Every component, composable and Vue API is imported explicitly. `~` points to `app/`. See `AGENTS.md` for the
import gotchas (`UIcon`, `$fetch`).

`App.vue` is the whole page: the board, the corner buttons, the command palette, the Add Card window, and the
confirmation dialogs. Settings and the confirmation dialogs are loaded lazily with `defineAsyncComponent`.

`App.vue` also runs `useKeepScreenAwake`, which holds a screen wake lock while **Keep screen awake** is on and asks
again when the page comes back into view (browsers drop it on hide). The Wake Lock API needs HTTPS; without it the
switch is disabled.

With **Show card images** off, cards render as text (`components/shared/CardText.vue`: name, mana cost as mana-font
symbols via `utils/manaSymbols.ts`, type line, P/T) on the board, in On-deck and in card details. Add Card results
and the event log drop their thumbnails, and the fetcher preloads no images. Cards cast again from the log have no
mana cost or P/T to show: the log keeps only the name, image and links.

## Folder layout

```text
app/
  features/        Vertical slices: each owns its store, components and widget
    addCard/       Manual card search (store, window, widget)
    battlefield/   The board's state: stacks, z-order, attaching, save/load
    discordFetcher/ Random-card fetching and the On-deck panel
    eventLog/      The event log: entry types, card snapshots, the store
    palette/       The command palette
    widgets/       The widget registry that feeds the palette and keyboard shortcuts
  components/      Shared and layout components: the board, cards, corner buttons, dialogs
  composables/     useScryfall, useLocalStorage, usePanAndZoom, useScaledDraggable, useReset
  stores/          App-wide stores: settings, inputMode
  types/           PlayArea (the board model), Scryfall, MtgConcepts (the modifier list)
public/            Served as-is: favicon, og-image.png (the social preview), manifest.webmanifest, icons/
scripts/og-image/  Source of og-image.png. Edit og-image.html, then `npm run og-image`
scripts/icons/     Source of public/icons/ (`npm run icons`) and the bundled Lucide set (`npm run icons:lucide`)
scripts/fonts/     Builds the mana-font subset in app/assets/ (`npm run fonts:mana`)
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

Add Card and the event log register widgets. Widgets have no settings of their own: the settings dialog binds to the
stores directly.

## Stores and persistence

Each persisted store follows the same pattern:

```ts
const STORAGE_KEY = 'mtg-harmony_<name>';

function save() { useLocalStorage().save(STORAGE_KEY, { …state }); }
function load(): boolean { const data = useLocalStorage().load(STORAGE_KEY); … validate each field … }

load();                 // On creation
watch([…state], save);  // On every change; deep only where data changes in place
```

- Only the battlefield's `stacks` and `zOrder` are deep-watched, because board cards change in place. On-deck's
  queue and shown card are only ever replaced, so they're shallow refs (the queue is triggered after a push or
  shift). The board centre is watched shallowly, so a pan doesn't walk every card.

- `load()` checks every field's type before using it, so stale or hand-edited storage can't break the app.
- Stores build their defaults from a `createDefaults()` factory where the defaults hold objects or arrays, so no
  two store instances share them.
- `reset()` returns a store to its defaults. `useReset()` builds the menu's three levels from these: **Clear
  board** (battlefield, for board wipes), **New game** (plus On-deck's queue and shown card, and a new game in the
  event log) and **Reset app** (plus settings and the whole event log). Each shows one toast.

| Key                          | Store                    | Holds                                                                        |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `mtg-harmony_battlefield`    | `useBattlefieldStore`    | Stacks, z-order, board centre, snap size                                     |
| `mtg-harmony_discordFetcher` | `useDiscordFetcherStore` | Queued cards, the shown card, settings                                       |
| `mtg-harmony_settings`       | `useSettingsStore`       | App settings                                                                 |
| `mtg-harmony_inputMode`      | `useInputModeStore`      | Last input mode (touch or cursor)                                            |
| `mtg-harmony_eventLog`       | `useEventLogStore`       | The current game's log entries, finished games not yet archived, the game ID |

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
moved and scaled with a single CSS `transform`. The grid and vignette behind it are a viewport-sized CSS background
(`.board-backdrop`) that follows the pan and zoom through CSS variables, so a pan or zoom never repaints a
5000 px layer. While panning, the board is its own GPU layer (`will-change: transform`); not otherwise, because a
layer kept through a zoom stays rastered at the old scale and blurs.

### Pan and zoom (`usePanAndZoom`)

- Mouse: drag to pan, wheel to zoom around the cursor. Trackpad pinch arrives as a wheel event with `ctrlKey`.
- Touch: one finger pans, two fingers pinch-zoom around their midpoint. Lifting one finger mid-pinch resumes the
  pan with the other.
- Position and scale are clamped so the canvas always fills the window. Scale is capped at 3.
- When a pan or zoom ends, the visible centre is written to the battlefield store, and new stacks appear there.
  It isn't written on every frame: that was too slow.
- The board's size, the gesture state and the speeds are plain variables; only `position`, `scale` and
  `isDragging` are reactive, because the board renders them.
- Pan and zoom are disabled while attaching, and so is stack dragging.

### Dragging stacks (`useScaledDraggable`)

Each stack (`BoardCardStack.vue`) uses `useBoardDraggable`. A capture-phase `pointerdown` on the stack starts a
drag; window listeners exist only while it lasts, so idle stacks cost nothing per pointer move. It divides pointer movement by the
board's scale, snaps to `snapScale` and clamps the stack inside the canvas. Stacks are placed with
`transform: translate()`, not `left`/`top`, so a move skips layout; the clamp bounds are measured once when a drag
starts; and a dragged stack is its own GPU layer. On drop it calls
`battlefield.setStackPosition()`. It reads the board's scale from the store (`boardScale()`) as the drag moves,
so a zoom doesn't re-render every stack. Drags and pans follow the **Pointer smoothing** setting
(`pointerSmoothing.ts`): 0 jumps to each pointer update; otherwise they ease towards it with that time
constant in ms. While a stack is dragged, the board's own touch handling stands down
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
- A `BoardCard` holds its Scryfall data (`scryfallInfo`), `tapped`, `faceNumber` (a big number shown on the card; 0 hides it), a
  `Set` of `modifiers`, and a back-reference to its `stack`.
- `scryfallInfo` keeps only the fields in `ScryfallCard` (`types/Scryfall.ts`), not the whole API response.
  `cardData()` trims it, freezes it and marks it raw, so Vue never tracks it and deep watchers and saves skip it.
  `createBoardCard` and the stores' `load()` run every card's data through it. To use another Scryfall field, add
  it to `ScryfallCard` and `cardData()`.
- A `BoardCardModifier` is one entry from `MODIFIERS` (`types/MtgConcepts.ts`) with a count.

Rules the battlefield store enforces:

- Every card on the board is in exactly one stack. Attaching moves the card out of its old stack first. A stack
  left without its primary explodes, and each remaining card becomes its own stack.
- A card can't be attached to itself, or to a stack it's already in.
- Only a stack's primary card is a valid attachment target.
- Attaching and putting under share one flow: `startAttaching(card, 'attach' | 'under')`, then tapping the target
  stack's primary calls `finishAttaching`. A card can move between a stack's attachments and its unders.
  `detach` takes either out into its own stack; a taken-out under lands below its old stack.
- Dragging a one-card stack and holding it over another stack's primary opens a radial menu around that card
  (`dragMenu.ts`, `DragRadialMenu.vue`, #108): solid arc segments centred on the card's top-right corner,
  **Attach to** from 1 to 2 o'clock and **Put under** from 2 to 3. The wait is the **Attach menu delay** setting
  (`dragMenuDelay`, 1 s by default, 0.25 to 3 s). Staying outside the bounding box of the stack and the menu for
  that long closes it, and the card under the pointer then starts its own wait. Dropping on a segment calls `dropCardOn`; dropping anywhere else is a normal move. A
  stack with attachments or unders never opens it (`canOfferDragMenu`). The dragged stack finds what is under
  the pointer with `elementsFromPoint`, so the segments keep `pointer-events`.
- Every card is its own instance. `createBoardCard` builds one from Scryfall data with a fresh ID, and the
  Scryfall ID stays on `scryfallInfo.id`. Casting from On-deck or Add Card goes through `castCard`, which puts a
  new instance on the board, so casting the same card twice gives two independent cards. The On-deck card never
  goes on the board itself.
- A cast card goes in a free spot in view (`findFreeSpot`, `placement.ts`): card-sized slots (16 px apart) spiral
  out from the middle of the view, and it takes the first one with at least 75% of the card (not its action buttons) in view and clear of other stacks. With none
  left, the spiral starts again 40 px down and right, so cards land offset from the layer below. Only stacks that
  touch the view count. Players rearrange cards anyway; this just keeps a few cast in a row from hiding each other.
  The board reports what it shows
  (`setView`, in board pixels, minus a 64 px strip at the top for the corner buttons) and each stack reports its rendered size
  (`setStackSize`); neither is saved, and neither is reactive, since they're only read when placing a card. Before the board reports a view, a cast card goes to `center`.
- The On-deck card can also be dragged onto the board (pointer events, so mouse and touch). The board reports its
  pan and zoom (`setTransform`); the drop point becomes a board point (`boardPointFromScreen`) and `castCard(card,
'cast', at)` centres the card on it. A drop on the panel or off the board cancels. On a phone the panel covers the
  board, so there the button is the way to cast.
- `copyCard(card, mode)` puts a copy in a new stack, 40 px down and right of the source, in front. `card` copies
  the card fresh, `counters` keeps its counters, face number and tapped state, and `stack` copies its whole stack
  (primary, attachments and unders, each with its state). Every copied card gets a new ID.
- Card and stack IDs come from `randomUUID` (`utils/randomUUID.ts`). It falls back to `crypto.getRandomValues`
  where `crypto.randomUUID` is missing, as on a plain-HTTP dev server opened from a phone.

## Event log

`features/eventLog` keeps one list of meaningful changes, newest last: fetched, cast, added, attached, put under,
copied, removed, board cleared and game markers. Moving, tapping and counters aren't logged.

The log is split in two (#81):

- **The current game** is `entries`, saved to `localStorage` and read synchronously. On-deck history, the idle
  prompt and anything else in play only ever need this game. `entries` is a `shallowRef`: entries never change
  once recorded, and deep reactivity over thousands of them cost tens of milliseconds per event.
- **Finished games** move to an IndexedDB archive (`archive.ts`, database `mtg-harmony`) when a new game starts.
  Each game is one record, so a card is stored once per game. Only the log window and export read it, through
  `loadHistory()` (once; archiving and clearing keep it up to date) and `history` (archive, then current game).
- Archive work runs one task at a time (`settled()` resolves when it's done). A finished game waits in `pending`,
  saved with the current game, until its archive write lands, so a tab closed mid-write archives it on the next
  start. Archiving a game again replaces it.
- Without IndexedDB (some private windows), finished games are dropped, `archiveAvailable` is false, and the log
  window says it shows this game only.

- `record(type, payload)` adds an entry with an ID, timestamp and the current game ID. Cards in the payload are
  stored as snapshots (`snapshotCard`: instance ID, Scryfall ID, name, image and Scryfall URI), so later changes
  on the board don't rewrite history. A card fetched but not yet on the board has no instance ID.
- Every entry about the same card shares one snapshot object, keyed by instance ID (or Scryfall ID for a card not
  on the board). devalue writes a shared object once, so the saved log stores each card once. 2,000 typical
  entries, card text included, come to about 0.8 MB.
- Events are recorded in the store actions, not in components:

  | Event          | Recorded by                                                        |
  | -------------- | ------------------------------------------------------------------ |
  | `fetched`      | `discordFetcher.next()`, the first time On-deck shows a card       |
  | `cast`/`added` | `battlefield.castCard(card, how)`; Add Card passes `'added'`       |
  | `attached`     | `battlefield.finishAttaching` in attach mode                       |
  | `putUnder`     | `battlefield.finishAttaching` in under mode                        |
  | `copied`       | `battlefield.copyCard`, with the new card, its source and the mode |
  | `removed`      | `battlefield.removeCard`, not the moves it causes                  |
  | `boardCleared` | `battlefield.clearBoard`, which the menu's clear actions call      |

  Internal moves (`removeCardFromStack`, `explodeStack`, `detach`) aren't logged.

- `startNewGame(reason)` moves the current game's entries to the archive, switches to a new game ID and records a
  `gameMarker`. A refresh never ends a game; neither does Clear board.
- The menu's **New game** (`useReset().newGame`) starts a new game. **Reset app** empties the log and the
  archive (`reset()`), back to a fresh install. **Clear past games** in the log window empties the archive only
  (`clearHistory()`), after a second click.
- After 2 hours without events (`IDLE_PROMPT_AFTER_MS`), `NewGamePrompt` offers a new game when the app opens or
  its tab comes back into view (`shouldOfferNewGame`). Only with cards on the board, and not when the last event
  is already a new game, so a player who cleared up or never played isn't asked. **New game** does what the menu's
  New game does, with the reason `idlePrompt`. Once the current game has 1,000 entries (`NEARLY_FULL_ENTRIES`),
  the prompt has a warning header and asks the player to start a new game at the start of each game. Closing it any other way dismisses the offer until there's new activity; the dismissal is saved.
- The **Event log** window (`EventLogWindow.vue`) opens from the palette (`e`, then `l`) or the menu. It lists
  entries newest first (`filterEntries`), filtered by event type and part of a card name, and shows the newest 200
  matches. A fetched entry has **Cast**, which casts the card again from its snapshot
  (`scryfallCardFromSnapshot`), for example after an accidental refetch.
- **Export** (in the log window, `ExportLogModal.vue`) copies or downloads events from the log: **cards cast**
  (`cast` and `added`), **all cards fetched** or **all** events, for this game, today or everything
  (`selectForExport`). Plain text is one line per event with local times; CSV has
  `time,event,card,details,scryfall_url,game` with UTC ISO times (`exportEntries`). `details` (`entryDetails`)
  covers what a card name doesn't: an attachment's target, a copy's mode, a new game's reason.
- **Limits.** The current game keeps at most 2,000 entries (`MAX_ENTRIES`); a realistic long game, six players
  over two sittings, logs about 1,000. Past that, it keeps whichever is smaller: the last 24 hours or the newest
  250 entries. The archive keeps a year and at most 500,000 entries (`ARCHIVE_MAX_AGE_MS`,
  `ARCHIVE_MAX_ENTRIES`), dropping whole games, oldest first, whenever a game is archived.

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
- **Look-ahead**: the fetcher fetches in batches of 10 into a queue. `next()` resolves as soon as the first card
  arrives, while the rest of the batch keeps loading. When fewer than 3 cards are queued, it tops up in the
  background. Overlapping fetches share one request. The next queued card's image is preloaded.
- **History**: the fetcher keeps only the queue and the newest card shown. Each shown card is logged as `fetched`,
  and "previous" steps back through those log entries (since the last New game), rebuilding each card from
  its snapshot. "Next" steps forward through them again before taking a new card from the queue.

## Gotchas

- **Touch listeners in `Board.vue` are added imperatively.** Vue's `@touchstart.stop.prevent` modifiers compile
  to a bubble-phase listener that calls `stopPropagation()`. That races with the capture-phase listeners `useBoardDraggable` puts
  on stacks, and breaks either board panning or card taps at random. The board adds `{ passive: false }`
  listeners itself, so it can `preventDefault()` without stopping propagation. `touchend` stays passive and isn't
  prevented, so the browser still turns taps into clicks on buttons.
- **The board wrapper is `touch-action: none`** (Tailwind's `touch-none`), so the browser doesn't pan or zoom the
  page under it. Safari's own pinch events are cancelled on the board (`useBlockBrowserZoom`). Its edge-swipe
  navigation can't be blocked from a page; installed to the home screen (`manifest.webmanifest`, standalone), the
  app has no browser navigation.
- **Installed, the page runs under the notch** (`viewport-fit=cover`, status bar `black-translucent`). Anything
  fixed to a screen edge adds `env(safe-area-inset-*)` to its offset, as the corner buttons do.
- **The mount element keeps `class="isolate"`** (`index.html`). Nuxt UI's overlays rely on it for stacking.
- **Board card sizes are CSS variables** (`--card-short-side`, `--card-long-side` in `main.css`), scaled per
  stack. Layout maths for attachments lives in `BoardCardStack.vue`'s styles.

## Tests

Unit tests (Vitest, `test/unit/`) cover the stores and `useLocalStorage`. End-to-end tests (Playwright,
`test/e2e/`) run against the production build with Scryfall mocked. Conventions are in `AGENTS.md`.
