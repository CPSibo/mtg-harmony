import { describe, expect, it } from 'vitest';
import {
  cardData,
  createBoardCard,
  useBattlefieldStore,
} from '~/features/battlefield';
import { tokenParts } from '~/features/battlefield/tokens';
import { useEventLogStore } from '~/features/eventLog';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard, makeTokenMaker } from '../../fixtures/cards';

const OOZE = {
  id: 'ooze-id',
  name: 'Ooze',
  type_line: 'Token Creature — Ooze',
};

describe('tokenParts (#203)', () => {
  it('lists the tokens a card makes, with their type lines', () => {
    const slime = cardData(makeTokenMaker([OOZE], { name: 'Mitotic Slime' }));

    expect(tokenParts(slime)).toEqual([{ ...OOZE, component: 'token' }]);
  });

  it('is empty for a card that makes no tokens', () => {
    expect(tokenParts(cardData(makeScryfallCard()))).toEqual([]);
  });

  it("leaves out a token card's own entry", () => {
    // Scryfall lists a token among its own parts, beside the cards making it.
    const ooze = cardData(
      makeScryfallCard({
        id: 'ooze-id',
        name: 'Ooze',
        all_parts: [
          { id: 'slime-id', component: 'combo_piece', name: 'Mitotic Slime' },
          { id: 'ooze-id', component: 'token', name: 'Ooze' },
        ],
      }),
    );

    expect(tokenParts(ooze)).toEqual([]);
  });

  it('lists a token once, however many times Scryfall does', () => {
    const card = cardData(
      makeTokenMaker([OOZE, OOZE, { id: 'c', name: 'Clue' }]),
    );

    expect(tokenParts(card).map((t) => t.name)).toEqual(['Ooze', 'Clue']);
  });

  it('keeps different tokens that share a name', () => {
    // Wurmcoil Engine makes a deathtouch Wurm and a lifelink Wurm.
    const wurmcoil = cardData(
      makeTokenMaker([
        { id: 'wurm-deathtouch', name: 'Wurm' },
        { id: 'wurm-lifelink', name: 'Wurm' },
      ]),
    );

    expect(tokenParts(wurmcoil).map((t) => t.id)).toEqual([
      'wurm-deathtouch',
      'wurm-lifelink',
    ]);
  });
});

describe('createToken (#203)', () => {
  it('puts the token on the board in its own stack and logs where it came from', () => {
    const board = useBattlefieldStore();
    const log = useEventLogStore();
    const slime = putOnBoard(
      board,
      createBoardCard(makeTokenMaker([OOZE], { name: 'Mitotic Slime' })),
    ).primary;

    const stack = board.createToken(
      slime,
      makeScryfallCard({ id: 'ooze-id', name: 'Ooze' }),
    );

    expect(board.stacks).toHaveLength(2);
    expect(stack.primary.scryfallInfo.name).toBe('Ooze');
    expect(stack.primary.id).not.toBe(slime.id);
    expect(log.entries.at(-1)).toMatchObject({
      type: 'tokenCreated',
      card: { name: 'Ooze' },
      source: { name: 'Mitotic Slime' },
    });
  });
});
