# MTG Harmony

Pull up this [helper app](https://mtg-harmony.com) on a phone, tablet, or other device at the game table and have everything you need to play "[Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony)", without stopping to draw tons of tokens.

Live: [mtg-harmony.com](https://mtg-harmony.com)

## Features

### On-deck

Open the On-deck panel and fetch a random non-land paper card from Scryfall with one tap or click. Cast it to the board, or clear it and fetch the next one. Previous and next step back and forth through every card fetched this session.

### The board

Every card you cast lands on a large board you can pan and zoom: drag and scroll with a mouse, or drag and pinch on a touchscreen. Drag a card to move it, and it snaps to a grid.

### Card actions

Each card on the board has quick buttons for tapping and removing it. Open a card's details (the **…** button, or double-click it) to:

- Tap or untap it.
- Add counters and keywords (+1/+1, loyalty, flying, haste, and more).
- Show a big number on the card, for anything you need to count.
- Attach it to another card, such as an Aura or Equipment, or detach it again. **Detach all** splits a card from everything attached to it.
- Open it on Scryfall.

The untap button in the top corner untaps everything at once.

### Command palette

Press <kbd>/</kbd> or the search button at the top for a list of commands and their keyboard shortcuts.

### Persistent sessions

The board and the On-deck history are saved on your device and come back when you reopen the page, so an accidental refresh or closed tab loses nothing. The menu can clear the board, clear the whole session, or reset all app data.

### Settings

Choose how many cards to fetch ahead, whether to preload the next card's image, and the board's grid size.

## AI Disclosure

I designed MTG Harmony and wrote its first version by hand. Since then, AI coding agents (Claude Code) have written much of the code under my direction. I decide what gets built and review and merge every change.

## Development

The app is a static Vue 3 + Vite site. [docs/architecture.md](docs/architecture.md) explains how it fits together, and [AGENTS.md](AGENTS.md) has the contributor workflow.

Use the Node version in `.node-version` (26). [fnm](https://github.com/Schniz/fnm) picks it up automatically.

```bash
npm ci                # Install dependencies
```

```bash
npm run dev           # http://localhost:5173
npm run dev-host      # Also reachable from other devices on your network
```

### Checks

```bash
npm run format:check  # Prettier (npm run format to fix)
npm run lint          # ESLint
npm run typecheck     # vue-tsc
npm test              # Vitest unit tests
npm run test:e2e      # Playwright end-to-end tests (run `npx playwright install chromium` once first)
```

### Production

```bash
npm run build         # Static site in dist/
npm run preview       # Serve dist/ locally
```

Cloudflare Pages builds and deploys from git: `main` to [mtg-harmony.com](https://mtg-harmony.com) and `dev` to [dev.mtg-harmony.com](https://dev.mtg-harmony.com).

## Credits

- [Scryfall API](https://scryfall.com/docs/api)
- [Mana font](https://mana.andrewgioia.com)
