import { describe, expect, it } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield';
import { useEventLogStore } from '~/features/eventLog';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';

function cards(n: number) {
  const battlefield = useBattlefieldStore();
  return Array.from(
    { length: n },
    () => putOnBoard(battlefield, makeCard()).primary,
  );
}

describe('acting on several cards (#221)', () => {
  it('taps them all if any is untapped, else untaps them all', () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = cards(2);
    a!.tapped = true;
    battlefield.tapOrUntap([a!, b!]);
    expect([a!.tapped, b!.tapped]).toEqual([true, true]);
    battlefield.tapOrUntap([a!, b!]);
    expect([a!.tapped, b!.tapped]).toEqual([false, false]);
  });

  it("changes each card's count by the amount, never below zero", () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = cards(2);
    battlefield.setModifierCount(a!, 'plus-one', 3);
    battlefield.changeModifier([a!, b!], 'plus-one', 1);
    expect(a!.modifiers.get('plus-one')).toBe(4);
    expect(b!.modifiers.get('plus-one')).toBe(1);
    battlefield.changeModifier([a!, b!], 'plus-one', -2);
    expect(a!.modifiers.get('plus-one')).toBe(2);
    expect(b!.modifiers.has('plus-one')).toBe(false);
  });

  it("clears every card's counters and keywords", () => {
    const battlefield = useBattlefieldStore();
    const [a, b] = cards(2);
    battlefield.setModifierCount(a!, 'plus-one', 3);
    battlefield.setModifierCount(b!, 'flying', 1);
    battlefield.clearModifiersOf([a!, b!]);
    expect(a!.modifiers.size + b!.modifiers.size).toBe(0);
  });

  it('copies each card in one log group', () => {
    const battlefield = useBattlefieldStore();
    const log = useEventLogStore();
    const targets = cards(3);
    const copies = battlefield.copyCards(targets, 'card');
    expect(copies).toHaveLength(3);
    expect(battlefield.stacks).toHaveLength(6);
    const logged = log.entries.filter((e) => e.type === 'copied');
    expect(logged).toHaveLength(3);
    expect(new Set(logged.map((e) => e.groupId)).size).toBe(1);
    expect(logged[0]!.groupId).toBeTruthy();
  });

  it('removes each card in one log group', () => {
    const battlefield = useBattlefieldStore();
    const log = useEventLogStore();
    const targets = cards(3);
    battlefield.removeCards(targets.slice(0, 2));
    expect(battlefield.stacks).toHaveLength(1);
    const logged = log.entries.filter((e) => e.type === 'removed');
    expect(logged).toHaveLength(2);
    expect(logged[0]!.groupId).toBe(logged[1]!.groupId);
  });
});
