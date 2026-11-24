import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { copyBoardCard } from '~/features/battlefield/boardCard';
import { doorNames, isRoom } from '~/features/battlefield/cardFaces';
import type { ScryfallCard } from '~/types/Scryfall';
import { makeScryfallCard } from '../../fixtures/cards';

/** Bottomless Pool // Locker Room, as Scryfall has it. */
function room(): ScryfallCard {
  return makeScryfallCard({
    name: 'Bottomless Pool // Locker Room',
    layout: 'split',
    type_line: 'Enchantment — Room // Enchantment — Room',
    mana_cost: '{U} // {4}{U}',
    card_faces: [
      {
        name: 'Bottomless Pool',
        mana_cost: '{U}',
        type_line: 'Enchantment — Room',
        oracle_text: 'When you unlock this door, …',
      },
      {
        name: 'Locker Room',
        mana_cost: '{4}{U}',
        type_line: 'Enchantment — Room',
        oracle_text: 'Whenever one or more creatures you control …',
      },
    ],
  });
}

describe('Rooms (#145)', () => {
  it('knows a Room by both faces being Rooms', () => {
    const split = makeScryfallCard({
      layout: 'split',
      card_faces: [
        { name: 'Fire', type_line: 'Instant' },
        { name: 'Ice', type_line: 'Instant' },
      ],
    });

    expect(isRoom(room())).toBe(true);
    expect(isRoom(split)).toBe(false);
    expect(isRoom(makeScryfallCard())).toBe(false);
  });

  it('names the doors, first door first', () => {
    expect(doorNames(createBoardCard(room()))).toEqual([
      'Bottomless Pool',
      'Locker Room',
    ]);
    expect(doorNames(createBoardCard(makeScryfallCard()))).toEqual([]);
  });

  it('starts a Room with both doors locked, and other cards without doors', () => {
    expect(createBoardCard(room()).lockedDoors).toEqual([0, 1]);
    expect(createBoardCard(makeScryfallCard()).lockedDoors).toBeUndefined();
  });

  it('copies the doors with the card’s state, as their own list', () => {
    const card = createBoardCard(room());
    card.lockedDoors = [1];

    const copy = copyBoardCard(card, true);
    copy.lockedDoors!.push(0);

    expect(card.lockedDoors).toEqual([1]);
    expect(copyBoardCard(card, false).lockedDoors).toEqual([0, 1]);
  });

  it('asks which door opens when a Room is cast', () => {
    const board = useBattlefieldStore();

    const stack = board.castCard(room());

    expect(board.doorChoice?.id).toBe(stack.primary.id);
    board.castCard(makeScryfallCard());
    expect(board.doorChoice?.id).toBe(stack.primary.id);
  });

  it('opens the chosen door and keeps the other locked', () => {
    const board = useBattlefieldStore();
    board.castCard(room());

    board.chooseDoors([1]);

    expect(board.stacks[0]!.primary.lockedDoors).toEqual([0]);
    expect(board.doorChoice).toBeNull();
  });

  it('can open both, or leave both locked', () => {
    const board = useBattlefieldStore();
    board.castCard(room());
    board.chooseDoors([0, 1]);
    board.castCard(room());
    board.chooseDoors();

    expect(board.stacks.map((s) => s.primary.lockedDoors)).toEqual([
      [],
      [0, 1],
    ]);
  });

  it('locks and unlocks one door at a time, only on Rooms', () => {
    const board = useBattlefieldStore();
    const card = board.castCard(room()).primary;
    board.chooseDoors([0]);
    const bear = board.castCard(makeScryfallCard()).primary;

    board.setDoorLocked(board.stacks[0]!.primary, 0, true);
    expect(board.stacks[0]!.primary.lockedDoors).toEqual([0, 1]);
    board.setDoorLocked(board.stacks[0]!.primary, 1, false);
    expect(board.stacks[0]!.primary.lockedDoors).toEqual([0]);
    board.setDoorLocked(bear, 0, true);

    expect(card.id).toBe(board.stacks[0]!.primary.id);
    expect(board.stacks[1]!.primary.lockedDoors).toBeUndefined();
  });

  it('forgets a pending choice on reset', () => {
    const board = useBattlefieldStore();
    board.castCard(room());

    board.reset();

    expect(board.doorChoice).toBeNull();
  });

  it('saves the doors with the board', async () => {
    vi.useFakeTimers();
    const board = useBattlefieldStore();
    board.castCard(room());
    board.chooseDoors([1]);
    await nextTick();
    vi.runAllTimers();

    board.reset();
    board.load();

    expect(board.stacks[0]!.primary.lockedDoors).toEqual([0]);
  });
});
