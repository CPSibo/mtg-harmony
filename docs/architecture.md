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

`App.vue` also runs `useKeepScreenAwake`, which holds a screen wake lock while **Keep screen awake** is on. Browsers
drop the lock when the page is hidden or on battery saver, and may refuse a request made without a recent tap. So it
asks again when the page comes back into view or gets focus, and when the lock drops while the page is shown. After a
refusal it asks again on the next tap or key press. It doesn't use VueUse's `useWakeLock`, which counted a dropped
lock as active after one failed request (#174). `wakeLockStatus` tells Settings whether the lock is held. The Wake Lock
API needs HTTPS; without it the switch is disabled.

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

- **Versions (#154).** Every save is stamped with its store's `SAVE_VERSION` (`useLocalStorage().save(key,
value, version)`), and `load(key, version)` ignores, with a warning, a save of any other version or none. A
  store that changes its saved shape bumps its version, and either lets old saves go or migrates them before
  loading. Archived games carry `RECORD_VERSION` the same way; `loadArchive()` skips other versions.
- **What `load()` checks.** Each top-level field's type, and every board card and stack: a stack needs an ID,
  a position, a valid primary card and `Set`s of attachments and unders; a card needs an ID, Scryfall data with
  an ID and name that `cardData()` can trim, `tapped`, `faceNumber` and a `Map` of modifiers. A malformed stack
  or primary card drops the stack; a malformed attachment, under or On-deck card drops just that card; an unknown
  modifier key drops just that modifier. Each drop is logged with `console.warn`. Event log entries need an ID,
  time, game ID and known type. Settings are checked value by value.
- **If the app still can't start**, `main.ts`'s `errorHandler` catches the error and `startupRecovery.ts` covers
  the page with what went wrong, **Reload** and **Reset app data** (deletes every `mtg-harmony_*` key and the
  archive, then reloads). Errors after startup are only logged.
- Stores build their defaults from a `createDefaults()` factory where the defaults hold objects or arrays, so no
  two store instances share them.
- `reset()` returns a store to its defaults. `useReset()` builds the menu's three levels from these: **Clear
  board** (battlefield, for board wipes), **New game** (plus On-deck's queue and shown card, and a new game in the
  event log) and **Reset app** (plus settings, the input mode and the whole event log). Each shows one toast. Every setting,
  On-deck's batch size, minimum queue and image preload included, lives in `useSettingsStore`, so Reset app
  restores them all (#159); the input mode goes back to its guess from the device.

| Key                          | Store                    | Holds                                                                        |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `mtg-harmony_battlefield`    | `useBattlefieldStore`    | Stacks, z-order, board centre, snap size                                     |
| `mtg-harmony_discordFetcher` | `useDiscordFetcherStore` | Queued cards, the shown card, the place in history                           |
| `mtg-harmony_settings`       | `useSettingsStore`       | App settings, On-deck's included                                             |
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
(`anyCardIsDragging`). A stack removed mid-drag (another finger, a board wipe) gets no `pointerup`, so the
composable ends the drag when it's disposed and calls `onCancel`, which hands the board back its touches and lets
the group drag and radial menu go (#160).

### Z-order

`battlefield.zOrder` is a list of stack IDs, front last. `orderedStacks` sorts a copy of `stacks` by it, so
rendering order changes without reordering the stacks themselves. Dragging a stack calls `bringToFront()`.
`load()` reconciles the saved order with the saved stacks: unknown IDs are dropped, and missing stacks are added
at the front.

### Selection

`useSelectionStore` (`features/battlefield/selection.ts`) holds the selected stack IDs, whether selection mode is
on, and a group drag's offset. It isn't saved. IDs of stacks that leave the board drop out of `size` and `ids()`.

- Ctrl/Cmd/Shift-click a stack toggles it. In selection mode (the corner button, or a 500 ms long press on a stack
  with a finger) a plain tap toggles it; the stack's own buttons still work.
- A press on the empty board draws a box instead of panning with Shift held (mouse) or in selection mode. The box
  selects every stack it touches, by the stack sizes the board reports; it adds to the selection with a modifier
  or in selection mode, and replaces it otherwise.
- A click on the empty board that doesn't move clears the selection. Esc clears it, then leaves selection mode.
  The bar at the bottom shows the count, and its X does both.
- Dragging one of several selected stacks moves them all. The dragged stack leads; the others render
  `groupOffset` on top of their own position and write their final positions, clamped to the board, on drop.
  A group drag doesn't open the radial menu.

### Keyboard and screen readers

- Every board card (`.card-image`, `role="img"` named after the card) is in the tab order. Enter or Space opens
  its details, or picks it as the target while attaching. Esc stops attaching before it clears a selection.
- A primary card comes before its stack's actions in the DOM, so Tab goes card, Tap, Card details, Copy, Remove.
  CSS `order` keeps the actions on the left. They hide with `opacity`, not `display: none`, so Tab can still
  reach them, and show on hover or `:has(:focus-visible)` (not plain focus, so they don't stay up after a click).
- Tab to a card off screen makes the browser scroll `.board-wrapper`. `Board.vue` undoes the scroll and pans
  the board by the same distance (`panBy`), so the pan and the pointer maths stay in step.
- Icon-only buttons carry an `aria-label`, and counters are buttons named after the counter and its count.
- Card outlines are `slate-500`, at least 3:1 against the board. The grid is decorative (`aria-hidden`) and
  stays faint.

### Input mode

`useInputModeStore` tracks whether the last pointer was a finger or a mouse, from `pointerdown` and `pointermove`
on `window`. Components use `isTouch` / `isCursor` to adapt, such as showing stack actions without hover. With no
saved mode, it guesses from `(pointer: coarse)`.

## Data model

The model is in `types/PlayArea.ts`; the terms are defined in [domain.md](domain.md).

- `Battlefield` holds `stacks`, `zOrder`, `center` and `snapScale`.
- A `BoardCardStack` has an `id`, a `position`, one `primary` card, and two `Set`s: `attachments` and `unders`.
- A `BoardCard` holds its Scryfall data (`scryfallInfo`), `tapped`, `faceNumber` (a big number shown on the card; 0 hides it), a
  `Map` of `modifiers`, and a back-reference to its `stack`. Its name, mana cost, image (`cardImage()`) and
  Scryfall link come from `scryfallInfo`; the card keeps no copies of them (#155), so `swapPrinting` only
  replaces `scryfallInfo`.
- `scryfallInfo` keeps only the fields in `ScryfallCard` (`types/Scryfall.ts`), not the whole API response.
  `cardData()` trims it, freezes it and marks it raw, so Vue never tracks it and deep watchers and saves skip it.
  `createBoardCard` and the stores' `load()` run every card's data through it. To use another Scryfall field, add
  it to `ScryfallCard` and `cardData()`.
- `modifiers` maps a modifier's `key` to its count (above 0). Names and mana-font classes are looked up in
  `MODIFIERS` (`types/MtgConcepts.ts`), so they can change without touching saved cards; keys never change once
  shipped. `setModifierCount` and `clearModifiers` change them.

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
  **Attach to** from 12 to 1:30 and **Put under** from 1:30 to 3. The wait is the **Attach menu delay** setting
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
- **Swap art** in card details (#114, `features/swapArt`, loaded on first use) lists the card's printings newest
  first (`order=released&dir=desc`), 24 per page; `unique=prints` already folds foil and non-foil into one entry.
  The set box filters on Scryfall (`e:<code>`, debounced 500 ms). Scryfall sends 175 per request, and the next
  request is made only when the grid pages past what's loaded. The pager is disabled while a request is
  pending, so it can't skip past a page that's still loading (#163). Picking one calls `swapPrinting`, which replaces
  the card's `scryfallInfo`, image and link and keeps its ID, stack and state. It isn't logged; the log's
  snapshots keep the art each event saw.
- **Meld** in card details (#143, `meld.ts`) shows on a meld half while its other half is on the board,
  attached, under or on its own (`meldPartner`, matched by name, so any printing counts). `cardData()` keeps only
  the meld parts of Scryfall's `all_parts`. It fetches the melded card by ID (`fetchCardById`, through the shared
  rate limit; disabled offline), then `meld` puts it in the first half's place in its stack and takes the other
  half off the board as if removed (its stack-mates explode out as usual). The melded card keeps both halves, in
  no stack and as they were, on `meldedFrom`, saved with it. **Unmeld** (`unmeld`) puts the first half back in
  its place and the second in a stack of its own beside it. A melded card cast or added directly, or a copy of
  one, has no halves and can't unmeld.
- Card and stack IDs come from `randomUUID` (`utils/randomUUID.ts`). It falls back to `crypto.getRandomValues`
  where `crypto.randomUUID` is missing, as on a plain-HTTP dev server opened from a phone.

## Event log

`features/eventLog` keeps one list of meaningful changes, newest last: fetched, cast, added, attached, put under,
copied, removed, melded, unmelded, board cleared and game markers. Moving, tapping and counters aren't logged.

The log is split in two (#81):

- **The current game** is `entries`, saved to `localStorage` and read synchronously. On-deck history, the idle
  prompt and anything else in play only ever need this game. `entries` is a `shallowRef`: entries never change
  once recorded, and deep reactivity over thousands of them cost tens of milliseconds per event.
- **Finished games** move to an IndexedDB archive (`archive.ts`, database `mtg-harmony`) when a new game starts.
  Each game is one record, so a card is stored once per game. Only the log window and export read it. The window
  calls `loadHistory()` when it opens (archiving and clearing then keep it up to date) and `unloadHistory()` when
  it closes, so past games aren't held in memory otherwise. It filters `pastEntries` (archive and `pending`) and
  `entries` apart, so a new event refilters only the current game. Export reads `history`, which joins all three
  (#173).
- Archive work runs one task at a time (`settled()` resolves when it's done). A finished game waits in `pending`,
  saved with the current game, until its archive write lands, so a tab closed mid-write archives it on the next
  start. Archiving a game again replaces it.
- Without IndexedDB (some private windows), finished games are dropped, `archiveAvailable` is false, and the log
  window says it shows this game only.
- A write that fails where IndexedDB exists (storage full, a transient error) keeps the game in `pending` and
  leaves `archiveAvailable` alone; the next start or New game retries it (#156). `archiveEntries` returns
  `archived`, `unavailable` or `failed` so the store can tell these apart.

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
  | `melded`       | `battlefield.meld`: the melded card and both halves                |
  | `unmelded`     | `battlefield.unmeld`: the melded card and both halves              |
  | `boardCleared` | `battlefield.clearBoard`, which the menu's clear actions call      |

  Moves within the board (`explodeStack`, `detach`) aren't logged. The store keeps its low-level helpers that
  change stacks without logging (`addStackByCard`, `removeStack`, `removeCardFromStack`, `clearStacks`)
  private, so the app can only change the board through actions that log what they should (#172). Tests put
  cards on the board with `putOnBoard` (`test/unit/fixtures/board.ts`).

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
  250 entries. The archive keeps a year and at most 100,000 entries (`ARCHIVE_MAX_AGE_MS`,
  `ARCHIVE_MAX_ENTRIES`), dropping whole games, oldest first, whenever a game is archived.

## Scryfall

All calls go straight from the browser to `api.scryfall.com`. There is no proxy or API key.

The site's security headers live in `public/_headers` (#157): a Content Security Policy that allows only the site's
own scripts, styles and fonts, images from `*.scryfall.io` and API calls to `api.scryfall.com` (inline styles stay
allowed for style bindings), plus `nosniff`, a referrer policy and a Permissions-Policy that allows only the screen
wake lock. A new host the app talks to has to be added there. Links to Scryfall go through `scryfallLink()`, which
drops anything that isn't a `https://scryfall.com/` page.

| Use              | Endpoint                                              | Where                                    |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- |
| On-deck fetching | `GET /cards/random?q=-t:land+game:paper`              | `useScryfall` → `useDiscordFetcherStore` |
| Add Card search  | `GET /cards/search?q=…` (debounced 500 ms, cancelled) | `AddCardWindow.vue`                      |
| Swap art         | `GET /cards/search?q=!"name" [e:set]&unique=prints`   | `usePrintings` → `SwapArtModal.vue`      |
| Meld             | `GET /cards/:id` (the meld result from `all_parts`)   | `fetchCardById` → `CardDetails.vue`      |

- **Rate limiting** (`composables/scryfallFetch.ts`): every API request goes through `scryfallFetch`, which
  queues them in one line spaced at least 600 ms apart, across On-deck, Add Card and Swap art (#158). A request
  aborted while queued gives up its slot. Scryfall allows about 2 per second. Card images come from
  `*.scryfall.io`, which has no rate limit, so they don't queue. A 429 waits out Scryfall's 30-second cooldown once; a second 429 stops the
  batch.
- **Images**: a fetched card without a usable image is retried once, then skipped. `pickImageUri()` prefers
  `border_crop`, then `normal`, then `small`.
- **Look-ahead**: the fetcher fetches in batches of 10 into a queue. `next()` resolves as soon as the first card
  arrives, while the rest of the batch keeps loading. When fewer than 3 cards are queued, it tops up in the
  background. Overlapping fetches share one request. The next queued card's image is preloaded.
- **History**: the fetcher keeps only the queue and the newest card shown. Each shown card is logged as `fetched`,
  and "previous" steps back through those log entries (since the last New game), rebuilding each card from
  its snapshot (once per card, so it keeps its ID while shown). "Next" steps forward through them again before
  taking a new card from the queue.
- **New game** (`reset()`) abandons a fetch under way: it stops at its next card and keeps none of them, and a
  `next()` that was waiting for it shows nothing (#162). The next fetch starts its own request.

## Version

Settings' footer shows the build's version, `v<version> (<short commit>)`, for bug reports (`utils/appVersion.ts`).
`buildInfo()` in `vite.config.ts` reads `version` from `package.json`. It takes the commit from
`CF_PAGES_COMMIT_SHA` or `GITHUB_SHA`, else from `git rev-parse`. It passes both to the app through Vite's `define`
(`__APP_VERSION__`, `__APP_COMMIT__`, declared in `app/env.d.ts`). A release bumps `version` and tags `v<version>`
on `main`.

## Offline

The production build has a service worker (#169). `vite.config.ts` generates `/sw.js` at build time from
`app/pwa/serviceWorker.ts`, with a precache list of the app shell: the page, every script, style and font in the
build, the manifest and icons. `app/pwa/register.ts` registers it after load; the dev server has none.

- Pages are network first. After 3 s, or offline, it serves the cached shell instead, so a deploy shows on the
  next load with a connection.
- Same-origin files are cache first; their names are content-hashed. Matches ignore `Vary`, because module
  scripts are CORS requests and the server answers with `Vary: Origin`.
- A new build installs its own cache and takes over at once. It keeps the previous build's cache, so a tab still
  on the old build can load its lazy chunks; older caches go.
- Scryfall requests and card images go to the network as before. Offline, images the browser hasn't cached
  don't load.
- `_headers` serves `sw.js` with `no-cache`.

Offline (VueUse `useOnline`), the parts that need Scryfall say so instead of failing per request:

- On-deck: Next card still steps through queued and shown cards, and otherwise says it's offline. The queue
  tops up when the connection comes back.
- Add Card: doesn't search.
- Swap art: disabled.

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
