import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  boardMenuGroups,
  createMenuGesture,
  type MenuPress,
} from '~/features/battlefield/contextMenu';
import type { WidgetCommand } from '~/features/widgets';
import { LONG_PRESS_MS, PRESS_SLOP } from '~/utils/press';

const touch = (over: Partial<MenuPress> = {}): MenuPress => ({
  pointerId: 1,
  pointerType: 'touch',
  button: 0,
  clientX: 100,
  clientY: 100,
  ...over,
});
const mouse = (over: Partial<MenuPress> = {}): MenuPress =>
  touch({ pointerType: 'mouse', button: 2, ...over });

describe('board menu gesture (#244)', () => {
  let open: ReturnType<typeof vi.fn<(at: { x: number; y: number }) => void>>;
  let canOpen: boolean;
  let canHold: boolean;
  let gesture: ReturnType<typeof createMenuGesture>;

  beforeEach(() => {
    vi.useFakeTimers();
    open = vi.fn<(at: { x: number; y: number }) => void>();
    canOpen = true;
    canHold = true;
    gesture = createMenuGesture({
      open,
      canOpen: () => canOpen,
      canHold: () => canHold,
    });
  });

  afterEach(() => gesture.dispose());

  describe('touch', () => {
    it('opens where a finger holds still on empty board', () => {
      gesture.down(touch(), true);
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
      expect(open).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(open).toHaveBeenCalledWith({ x: 100, y: 100 });
      expect(gesture.held).toBe(true);
    });

    it('allows a little movement, but not a pan', () => {
      gesture.down(touch(), true);
      gesture.move(touch({ clientX: 100 + PRESS_SLOP }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).toHaveBeenCalledTimes(1);

      gesture.up(touch());
      gesture.down(touch(), true);
      gesture.move(touch({ clientX: 101 + PRESS_SLOP }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('cancels for a second finger, a pinch', () => {
      gesture.down(touch(), true);
      gesture.down(touch({ pointerId: 2, clientX: 300 }), true);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).not.toHaveBeenCalled();
    });

    it('cancels when the finger lifts or the press is cancelled', () => {
      gesture.down(touch(), true);
      gesture.up(touch());
      gesture.down(touch({ pointerId: 2 }), true);
      gesture.cancel(touch({ pointerId: 2 }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).not.toHaveBeenCalled();
    });

    it('ignores a hold on a card', () => {
      gesture.down(touch(), false);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).not.toHaveBeenCalled();
    });

    it('ignores a hold where holding is off, like selection mode', () => {
      canHold = false;
      gesture.down(touch(), true);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(open).not.toHaveBeenCalled();
    });

    it("forgets the hold at the next press, so that press's tap still counts", () => {
      gesture.down(touch(), true);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      gesture.up(touch());
      expect(gesture.held).toBe(true);

      gesture.down(touch(), true);
      expect(gesture.held).toBe(false);
    });
  });

  describe('mouse', () => {
    it('opens on a right-click on empty board, when the button comes up', () => {
      gesture.down(mouse(), true);
      expect(open).not.toHaveBeenCalled();

      gesture.up(mouse({ clientX: 103 }));
      expect(open).toHaveBeenCalledWith({ x: 103, y: 100 });
    });

    it('leaves a right-drag to pan', () => {
      gesture.down(mouse(), true);
      gesture.move(mouse({ clientX: 101 + PRESS_SLOP, button: -1 }));
      gesture.move(mouse({ button: -1 }));
      gesture.up(mouse());
      expect(open).not.toHaveBeenCalled();
    });

    it('ignores the left button, and a right-click on a card', () => {
      gesture.down(mouse({ button: 0 }), true);
      gesture.up(mouse({ button: 0 }));
      gesture.down(mouse(), false);
      gesture.up(mouse());
      expect(open).not.toHaveBeenCalled();
    });

    it('opens in selection mode too, where only a touch hold is off', () => {
      canHold = false;
      gesture.down(mouse(), true);
      gesture.up(mouse());
      expect(open).toHaveBeenCalledTimes(1);
    });
  });

  it('never opens while it may not, like while attaching', () => {
    canOpen = false;
    gesture.down(mouse(), true);
    gesture.up(mouse());
    gesture.down(touch(), true);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('board menu items (#244)', () => {
  const command = (id: string, enabled = true): WidgetCommand => ({
    id,
    label: id,
    icon: 'i-lucide-plus',
    enabled: () => enabled,
    execute: () => {},
  });
  const menu = (...commands: WidgetCommand[]) =>
    boardMenuGroups(commands).map((g) => g.map((i) => i.cmd.id));

  const all = [
    'onDeck.cast',
    'addCard.open',
    'arrange.smart',
    'board.zoomToFit',
    'board.resetView',
    'select.all',
  ];

  it('lists its commands in groups, and nothing else', () => {
    expect(
      menu(...all.map((id) => command(id)), command('board.untapAll')),
    ).toEqual([
      ['onDeck.cast', 'addCard.open'],
      ['arrange.smart', 'board.zoomToFit', 'board.resetView'],
      ['select.all'],
    ]);
  });

  it('leaves out what does not apply, and empty groups', () => {
    expect(
      menu(
        command('onDeck.cast', false),
        command('addCard.open'),
        command('arrange.smart', false),
        command('board.zoomToFit', false),
        command('board.resetView', false),
      ),
    ).toEqual([['addCard.open']]);
  });

  it('offers Deselect all once everything is selected', () => {
    const groups = boardMenuGroups([
      command('select.all', false),
      command('selection.clear'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((i) => [i.cmd.id, i.label])).toEqual([
      ['selection.clear', 'Deselect all'],
    ]);
  });

  it('offers Select all over Deselect all while some are selected', () => {
    expect(menu(command('select.all'), command('selection.clear'))).toEqual([
      ['select.all'],
    ]);
  });

  it('names the cast for where it lands', () => {
    const [group] = boardMenuGroups([command('onDeck.cast')]);
    expect(group?.[0]?.label).toBe('Cast On-deck card here');
  });
});
