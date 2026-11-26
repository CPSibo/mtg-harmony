import { describe, expect, it, vi } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield';
import { UNDO_LIMIT } from '~/features/battlefield/undo';
import { useEventLogStore } from '~/features/eventLog';
import { putOnBoard } from '../../fixtures/board';
import {
  makeCard,
  makeMeldCards,
  makeScryfallCard,
} from '../../fixtures/cards';

/** Each stack as its primary's name, with its attachments' and unders'. */
function layout() {
  return useBattlefieldStore().stacks.map((s) => ({
    primary: s.primary.scryfallInfo.name,
    attachments: [...s.attachments].map((c) => c.scryfallInfo.name),
    unders: [...s.unders].map((c) => c.scryfallInfo.name),
  }));
}

function types() {
  return useEventLogStore().entries.map((e) => e.type);
}

describe('undo and redo (#215)', () => {
  it('has nothing to undo or redo at first', () => {
    const board = useBattlefieldStore();
    expect(board.canUndo).toBe(false);
    expect(board.canRedo).toBe(false);
    expect(board.undo()).toBe(false);
    expect(board.redo()).toBe(false);
  });

  it('undoes a cast, dropping its log entry, and redoes it', () => {
    const board = useBattlefieldStore();
    const stack = board.castCard(makeScryfallCard({ name: 'Bear' }));
    const id = stack.primary.id;
    expect(board.canUndo).toBe(true);

    expect(board.undo()).toBe(true);
    expect(board.stacks).toHaveLength(0);
    expect(types()).toEqual([]);
    expect(board.canRedo).toBe(true);

    expect(board.redo()).toBe(true);
    expect(layout()).toEqual([
      { primary: 'Bear', attachments: [], unders: [] },
    ]);
    expect(board.stacks[0]!.primary.id).toBe(id);
    expect(types()).toEqual(['cast']);
  });

  it('brings a removed card back to its stack and spot', () => {
    const board = useBattlefieldStore();
    const host = putOnBoard(board, makeCard({ name: 'Host' }), {
      x: 100,
      y: 200,
    });
    const aura = makeCard({ name: 'Aura' });
    const under = makeCard({ name: 'Under' });
    putOnBoard(board, aura);
    putOnBoard(board, under);
    board.dropCardOn(aura, host, 'attach');
    board.dropCardOn(under, host, 'under');

    // Removing the primary explodes its stack.
    board.removeCard(host.primary);
    expect(layout().map((s) => s.primary)).toEqual(['Aura', 'Under']);

    board.undo();
    expect(layout()).toEqual([
      { primary: 'Host', attachments: ['Aura'], unders: ['Under'] },
    ]);
    const restored = board.stacks[0]!;
    expect(restored.id).toBe(host.id);
    expect(restored.position).toEqual({ x: 100, y: 200 });
    expect(restored.primary.stack).toBe(restored);
    expect([...restored.attachments][0]!.stack).toBe(restored);
    expect(types().filter((t) => t === 'removed')).toEqual([]);
  });

  it('undoes a bulk action as one step', () => {
    const board = useBattlefieldStore();
    const cards = [1, 2, 3].map(
      (n) => putOnBoard(board, makeCard({ name: `C${n}` })).primary,
    );
    board.removeCards(cards);
    expect(board.stacks).toHaveLength(0);

    board.undo();
    expect(layout().map((s) => s.primary)).toEqual(['C1', 'C2', 'C3']);
    expect(board.canUndo).toBe(false);
  });

  it('undoes copies, attaching, detaching and splitting', () => {
    const board = useBattlefieldStore();
    const a = putOnBoard(board, makeCard({ name: 'A' }));
    const b = putOnBoard(board, makeCard({ name: 'B' }));
    const start = layout();

    board.copyCards([a.primary], 'card');
    board.dropCardOn(b.primary, a, 'attach');
    const attached = layout();
    board.detach(b.primary);
    board.dropCardOn(board.stacks.at(-1)!.primary, a, 'under');
    board.explodeAll([a]);

    board.undo(); // split
    board.undo(); // put under
    board.undo(); // detach
    expect(layout()).toEqual(attached);
    board.undo(); // attach
    board.undo(); // copy
    expect(layout()).toEqual(start);
    expect(board.canUndo).toBe(false);
  });

  it('keeps taps, counters and moves made since the undone action', () => {
    const board = useBattlefieldStore();
    const keeper = putOnBoard(board, makeCard({ name: 'Keeper' }));
    const doomed = putOnBoard(board, makeCard({ name: 'Doomed' }));
    board.removeCard(doomed.primary);

    board.toggleTapped(keeper.primary);
    board.setModifierCount(keeper.primary, 'plus-one', 2);
    board.setStackPosition(keeper, { x: 900, y: 900 });
    board.undo();

    const restored = board.stacks.find((s) => s.id === keeper.id)!;
    expect(restored.primary.tapped).toBe(true);
    expect(restored.primary.modifiers.get('plus-one')).toBe(2);
    expect(restored.position).toEqual({ x: 900, y: 900 });
    expect(layout().map((s) => s.primary)).toEqual(['Keeper', 'Doomed']);
  });

  it("doesn't count taps, counters or moves as steps", () => {
    const board = useBattlefieldStore();
    const stack = putOnBoard(board, makeCard());
    board.toggleTapped(stack.primary);
    board.setModifierCount(stack.primary, 'plus-one', 1);
    board.setStackPosition(stack, { x: 5, y: 5 });
    board.arrangeInLine([stack], 'row');
    expect(board.canUndo).toBe(false);
  });

  it('undoes clearing the board', () => {
    const board = useBattlefieldStore();
    putOnBoard(board, makeCard({ name: 'A' }));
    putOnBoard(board, makeCard({ name: 'B' }));
    board.clearBoard();
    expect(board.stacks).toHaveLength(0);

    board.undo();
    expect(layout().map((s) => s.primary)).toEqual(['A', 'B']);
    expect(types()).not.toContain('boardCleared');
  });

  it('undoes a meld and an unmeld', () => {
    const board = useBattlefieldStore();
    const { bruna, gisela, brisela } = makeMeldCards();
    const first = board.castCard(bruna).primary;
    board.castCard(gisela);
    board.clearHistory();
    const melded = board.meld(first, brisela)!;
    board.unmeld(melded);

    board.undo(); // unmeld
    expect(layout().map((s) => s.primary)).toEqual([
      'Brisela, Voice of Nightmares',
    ]);
    // Still melded, so it can unmeld again.
    expect(board.stacks[0]!.primary.meldedFrom).toHaveLength(2);

    board.undo(); // meld
    expect(layout().map((s) => s.primary)).toEqual([
      'Bruna, the Fading Light',
      'Gisela, the Broken Blade',
    ]);

    board.redo();
    board.redo();
    expect(layout().map((s) => s.primary)).toEqual([
      'Bruna, the Fading Light',
      'Gisela, the Broken Blade',
    ]);
    expect(types()).toEqual(['cast', 'cast', 'melded', 'unmelded']);
  });

  it('forgets what it could redo once something new happens', () => {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard());
    board.undo();
    board.castCard(makeScryfallCard());
    expect(board.canRedo).toBe(false);
  });

  it('keeps only the newest steps', () => {
    const board = useBattlefieldStore();
    for (let i = 0; i < UNDO_LIMIT + 5; i++) board.castCard(makeScryfallCard());
    let undone = 0;
    while (board.undo()) undone++;
    expect(undone).toBe(UNDO_LIMIT);
    expect(board.stacks).toHaveLength(5);
  });

  it('puts back log entries in time order around later ones', () => {
    const board = useBattlefieldStore();
    const log = useEventLogStore();
    vi.useFakeTimers({ toFake: ['Date'], now: 1000 });
    board.castCard(makeScryfallCard());
    board.undo();
    vi.setSystemTime(2000);
    log.record('fetched', { card: makeScryfallCard() });
    board.redo();
    expect(types()).toEqual(['cast', 'fetched']);
  });

  it('stops attaching and the door choice when their card leaves', () => {
    const board = useBattlefieldStore();
    const room = board.castCard(
      makeScryfallCard({
        name: 'Door A // Door B',
        layout: 'split',
        type_line: 'Enchantment — Room // Enchantment — Room',
        card_faces: [
          { name: 'Door A', type_line: 'Enchantment — Room' },
          { name: 'Door B', type_line: 'Enchantment — Room' },
        ],
      }),
    );
    expect(board.doorChoice).not.toBeNull();
    board.startAttaching(room.primary);
    board.undo();
    expect(board.isAttaching).toBe(false);
    expect(board.doorChoice).toBeNull();
  });

  it('clearHistory forgets every step', () => {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard());
    board.undo();
    board.castCard(makeScryfallCard());
    board.clearHistory();
    expect(board.canUndo).toBe(false);
    expect(board.canRedo).toBe(false);
  });
});
