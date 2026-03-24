# MTG Harmony

Pull up this [helper app](https://mtg-harmony.com) on a phone, tablet, or other device at the game table and have everything you need to play "[Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony)", without stopping to draw tons of tokens.

Live: [mtg-harmony.com](https://mtg-harmony.com)

## Features

### On-deck
Fetch a random non-land paper card from Scryfall at any time with one tap/click. Cast it or discard it.

### Card grid
A grid of permanents you cast from the On-deck slot. Swipe to change pages.

### Context menu
Long-press or right-click any grid slot to open the card in Scryfall, remove the card, duplicate it, adjust its count, or add a modifier.

### Fetch history
A log of every card fetched, with the option to export the log in multiple formats.

### Persistent sessions
The app's state is automatically saved to your device and reloaded when you visit the page (so no worries if you accidentally refresh or close the browser). Clear the session under the settings menu.

### Settings
Multiple options to pick how compact or easy-to-see your board state and the On-deck cards are.

## AI Disclosure

This application was made with the help of generative AI. I've used this small app as a test of current LLM workflows and capabilities, allowing it to write most of the actual lines of code.

I've manually written all architectural instructions, use cases, and this file. I've reviewed all generated code for security and performance concerns but otherwise allowed the agents to implement features and fixes as they will.


## Development

```bash
npm install           # Install dependencies
```

```bash
# http://localhost:3000

npm run dev           # View locally
npm run dev-host      # View from another device
```

### Testing

```bash
npm run lint          # ESLint
npm run typecheck     # vue-tsc
npm run test          # Vitest (unit)
npm run test:e2e      # Playwright (end-to-end)
```

### Production

```bash
npm run generate      # .../.output/
```

The output is a fully static site with no server requirements. Deploy to any static host (Vercel, Netlify, GitHub Pages, etc.).


## Credits

- [Scryfall API](https://scryfall.com/docs/api)
- [Mana font](https://mana.andrewgioia.com)
- [Keyrune font](https://keyrune.andrewgioia.com)
