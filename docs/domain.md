# Domain

What the app models and the words the code uses for it.

## Every card is a token

The app supports games of Magic: The Gathering built around
[Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony), which repeatedly casts
copies of random cards. Copies of spells are tokens, so every card the app tracks is a token: either one of those
copies, or a physical card a player mirrors onto the board by hand. Tokens that leave the battlefield cease to
exist, so the app has no library, hand, graveyard or exile. A card is either on the board or gone.

## Glossary

| Term                    | Meaning                                                                                                                                                                                                                                     | Code                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Fetcher**             | Pulls random non-land paper cards from Scryfall, one at a time, so the player can cast or skip each. Keeps a queue of cards fetched ahead; cards it has shown are in the event log, and "previous" steps back through them.                 | `features/discordFetcher`             |
| **Add card**            | Manual search for a specific card, mainly to mirror a physical card onto the board.                                                                                                                                                         | `features/addCard`                    |
| **Board** (battlefield) | The pan-and-zoom canvas holding every stack. Positions can snap to a grid.                                                                                                                                                                  | `features/battlefield`, `Battlefield` |
| **Board card**          | One token: its Scryfall data, which face is showing, whether it's tapped, and its modifiers.                                                                                                                                                | `BoardCard`                           |
| **Stack**               | A group of board cards that sit and move together at one board position. Every card on the board belongs to exactly one stack.                                                                                                              | `BoardCardStack`                      |
| **Primary**             | The card a stack is built around. A card on its own is the primary of a one-card stack.                                                                                                                                                     | `BoardCardStack.primary`              |
| **Attachment**          | A card attached to the primary, such as an Aura or Equipment. Detaching it puts it back on the board as its own stack.                                                                                                                      | `BoardCardStack.attachments`          |
| **Under**               | A card physically placed under the primary: exiled "until this leaves the battlefield", hideaway, and similar effects. Drawn as edges peeking out above the primary. Put a card under with **Put under...**, take it out with **Take out**. | `BoardCardStack.unders`               |
| **Modifier**            | A counter (+1/+1, loyalty, ...) or granted keyword (flying, haste, ...) on a board card, with a count. The available list is in `types/MtgConcepts.ts`.                                                                                     | `BoardCardModifier`, `MODIFIERS`      |
| **Exploding** a stack   | Splitting a stack so each of its cards becomes its own stack.                                                                                                                                                                               | `explodeStack`                        |
| **Widget**              | A feature's registration: the commands and settings it contributes to the command palette and settings menu.                                                                                                                                | `features/widgets`                    |
