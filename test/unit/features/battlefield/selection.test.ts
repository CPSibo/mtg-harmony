import { describe, expect, it } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield/store';
import { useSelectionStore } from '~/features/battlefield/selection';
import { makeCard } from '../../fixtures/cards';

function boardWithStacks(...positions: { x: number; y: number }[]) {
  const battlefield = useBattlefieldStore();
  for (const position of positions)
    battlefield.addStackByCard(makeCard(), position);
  const stacks = battlefield.stacks;
  stacks.forEach((s) =>
    battlefield.setStackSize(s.id, { width: 100, height: 140 }),
  );
  return { battlefield, stacks };
}

describe('useSelectionStore (#138)', () => {
  it('toggles stacks in and out of the selection', () => {
    const { stacks } = boardWithStacks({ x: 0, y: 0 }, { x: 500, y: 0 });
    const selection = useSelectionStore();
    selection.toggle(stacks[0]!.id);
    selection.toggle(stacks[1]!.id);
    expect(selection.size).toBe(2);
    selection.toggle(stacks[0]!.id);
    expect(selection.has(stacks[0]!.id)).toBe(false);
    expect(selection.has(stacks[1]!.id)).toBe(true);
  });

  it('selects the stacks a box touches, replacing the selection', () => {
    const { stacks } = boardWithStacks(
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 1000, y: 1000 },
    );
    const selection = useSelectionStore();
    selection.toggle(stacks[2]!.id);
    selection.selectInRect({ x: 50, y: 50, width: 500, height: 10 }, false);
    expect(selection.ids()).toEqual([stacks[0]!.id, stacks[1]!.id]);
  });

  it('adds a box to the selection when additive', () => {
    const { stacks } = boardWithStacks({ x: 0, y: 0 }, { x: 1000, y: 1000 });
    const selection = useSelectionStore();
    selection.toggle(stacks[1]!.id);
    selection.selectInRect({ x: -10, y: -10, width: 20, height: 20 }, true);
    expect(selection.size).toBe(2);
  });

  it('clears the selection and leaves selection mode on Esc', () => {
    const { stacks } = boardWithStacks({ x: 0, y: 0 });
    const selection = useSelectionStore();
    selection.setMode(true);
    selection.toggle(stacks[0]!.id);
    selection.escape();
    expect(selection.size).toBe(0);
    expect(selection.mode).toBe(true);
    selection.escape();
    expect(selection.mode).toBe(false);
  });

  it('drops stacks that leave the board', async () => {
    const { battlefield, stacks } = boardWithStacks({ x: 0, y: 0 });
    const selection = useSelectionStore();
    selection.toggle(stacks[0]!.id);
    battlefield.removeStack(stacks[0]!);
    expect(selection.size).toBe(0);
  });

  it("moves the other selected stacks by the leader's offset", () => {
    const { battlefield, stacks } = boardWithStacks(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      { x: 900, y: 900 },
    );
    const selection = useSelectionStore();
    selection.toggle(stacks[0]!.id);
    selection.toggle(stacks[1]!.id);
    expect(selection.startGroupDrag(stacks[0]!.id)).toBe(true);
    selection.moveGroup({ x: 40, y: -20 });
    expect(selection.groupOffset).toEqual({ x: 40, y: -20 });
    selection.endGroupDrag();
    expect(battlefield.stacks[1]!.position).toEqual({ x: 340, y: 180 });
    expect(battlefield.stacks[2]!.position).toEqual({ x: 900, y: 900 });
    expect(selection.groupOffset).toEqual({ x: 0, y: 0 });
  });

  it('keeps group-dragged stacks on the board', () => {
    const { battlefield, stacks } = boardWithStacks(
      { x: 100, y: 100 },
      { x: 10, y: 4800 },
    );
    const selection = useSelectionStore();
    selection.toggle(stacks[0]!.id);
    selection.toggle(stacks[1]!.id);
    selection.startGroupDrag(stacks[0]!.id);
    selection.moveGroup({ x: -50, y: 100 });
    selection.endGroupDrag();
    expect(battlefield.stacks[1]!.position).toEqual({ x: 0, y: 4860 });
  });

  it('does not group-drag an unselected or lone stack', () => {
    const { stacks } = boardWithStacks({ x: 0, y: 0 }, { x: 500, y: 0 });
    const selection = useSelectionStore();
    expect(selection.startGroupDrag(stacks[0]!.id)).toBe(false);
    selection.toggle(stacks[0]!.id);
    expect(selection.startGroupDrag(stacks[0]!.id)).toBe(false);
  });
});
