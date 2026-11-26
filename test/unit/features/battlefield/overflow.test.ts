import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  arrangeInGrid,
  useBattlefieldStore,
} from '~/features/battlefield';
import { useEventLogStore } from '~/features/eventLog';
import { isCounter } from '~/types/MtgConcepts';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';

function stacks(n: number) {
  const battlefield = useBattlefieldStore();
  return Array.from({ length: n }, (_, i) => {
    const s = putOnBoard(battlefield, makeCard(), { x: 1000 + i * 37, y: 900 });
    battlefield.setStackSize(s.id, { width: 100, height: 140 });
    return s;
  });
}

describe('isCounter (#222)', () => {
  it.each([
    ['plus-one', true],
    ['loyalty', true],
    ['prepared', false],
    ['flying', false],
  ] as const)('%s → %s', (key, expected) => {
    expect(isCounter(key)).toBe(expected);
  });
});

describe('the selection overflow (#222)', () => {
  it('proliferates: one more of each counter a card has, keywords alone', () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = stacks(2).map((s) => s.primary);
    battlefield.setModifierCount(a!, 'plus-one', 2);
    battlefield.setModifierCount(a!, 'flying', 1);
    battlefield.setModifierCount(b!, 'loyalty', 3);
    battlefield.proliferate([a!, b!]);
    expect(Object.fromEntries(a!.modifiers)).toEqual({
      'plus-one': 3,
      flying: 1,
    });
    expect(Object.fromEntries(b!.modifiers)).toEqual({ loyalty: 4 });
  });

  it('lays items out in a grid from a corner, in reading order', () => {
    const size = { width: 100, height: 140 };
    const at = arrangeInGrid(
      [
        { id: 'b', size, position: { x: 50, y: 0 } },
        { id: 'a', size, position: { x: 0, y: 0 } },
        { id: 'c', size, position: { x: 0, y: 500 } },
      ],
      { x: 10, y: 20 },
      2,
      5,
    );
    expect(at.get('a')).toEqual({ x: 10, y: 20 });
    expect(at.get('b')).toEqual({ x: 115, y: 20 });
    expect(at.get('c')).toEqual({ x: 10, y: 165 });
  });

  it('arranges stacks in a row from their top-left corner', () => {
    const battlefield = useBattlefieldStore();
    const targets = stacks(3);
    battlefield.arrangeInLine(targets, 'row');
    const ys = new Set(targets.map((s) => s.position.y));
    expect(ys.size).toBe(1);
    expect(targets[0]!.position.x).toBe(1000);
    expect(targets[1]!.position.x).toBeGreaterThan(1100);
  });

  it('keeps an arrangement on the board', () => {
    const battlefield = useBattlefieldStore();
    const targets = stacks(3);
    targets.forEach((s) =>
      battlefield.setStackPosition(s, { x: BOARD_SIZE.width - 120, y: 0 }),
    );
    battlefield.arrangeInLine(targets, 'row');
    for (const s of targets)
      expect(s.position.x + 100).toBeLessThanOrEqual(BOARD_SIZE.width);
  });

  it('arranges in a grid about as wide as it is tall', () => {
    const battlefield = useBattlefieldStore();
    const targets = stacks(4);
    battlefield.arrangeInLine(targets, 'grid');
    expect(new Set(targets.map((s) => s.position.y)).size).toBe(2);
  });

  it('brings stacks to the front, keeping their order', () => {
    const battlefield = useBattlefieldStore();
    const [a, b, c] = stacks(3);
    battlefield.bringAllToFront([b!, a!]);
    expect(battlefield.orderedStacks.map((s) => s.id)).toEqual([
      c!.id,
      a!.id,
      b!.id,
    ]);
  });

  it('flips them all over if any is face up, else back', () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = stacks(2).map((s) => s.primary);
    a!.flipped = true;
    battlefield.flipAll([a!, b!]);
    expect([a!.flipped, b!.flipped]).toEqual([true, true]);
    battlefield.flipAll([a!, b!]);
    expect([a!.flipped, b!.flipped]).toEqual([false, false]);
  });

  it('explodes every stack', () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = stacks(2);
    a!.attachments.add(makeCard());
    b!.unders.add(makeCard());
    battlefield.explodeAll([a!, b!]);
    expect(battlefield.stacks).toHaveLength(4);
  });

  it('attaches several cards to one target, logged as one group', () => {
    const battlefield = useBattlefieldStore();
    const log = useEventLogStore();
    const [a, b, target] = stacks(3);
    battlefield.startAttachingAll([a!.primary, b!.primary], 'attach');
    expect(battlefield.isValidAttachmentTarget(a!.primary)).toBe(false);
    expect(battlefield.isValidAttachmentTarget(target!.primary)).toBe(true);
    battlefield.finishAttaching(
      battlefield.stacks.find((s) => s.id === target!.id)!,
    );
    expect(battlefield.stacks).toHaveLength(1);
    expect(battlefield.stacks[0]!.attachments.size).toBe(2);
    expect(battlefield.isAttaching).toBe(false);
    const logged = log.entries.filter((e) => e.type === 'attached');
    expect(logged).toHaveLength(2);
    expect(logged[0]!.groupId).toBe(logged[1]!.groupId);
  });

  it('shows each card as text if any shows art, else as art', () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = stacks(2).map((s) => s.primary);
    a!.shownAs = 'text';
    battlefield.showAllAs([a!, b!], true);
    expect([a!.shownAs, b!.shownAs]).toEqual(['text', 'text']);
    battlefield.showAllAs([a!, b!], true);
    expect([a!.shownAs, b!.shownAs]).toEqual(['art', 'art']);
  });

  it("clears every card's own art-or-text setting", () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = stacks(2).map((s) => s.primary);
    a!.shownAs = 'text';
    b!.shownAs = 'art';
    battlefield.clearShownAs();
    expect([a!.shownAs, b!.shownAs]).toEqual([undefined, undefined]);
  });
});
