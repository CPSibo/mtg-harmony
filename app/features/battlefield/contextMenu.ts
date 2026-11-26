// The board menu (#244): a context menu on empty board, opened by a
// right-click, a long press or the keyboard's menu key.

import { commandApplies, type WidgetCommand } from '~/features/widgets';
import { LONG_PRESS_MS, PRESS_SLOP } from '~/utils/press';
import type { Position } from '@vueuse/core';

/** The parts of a pointer event the gesture reads. */
export type MenuPress = Pick<
  PointerEvent,
  'pointerId' | 'pointerType' | 'button' | 'clientX' | 'clientY'
>;

export interface MenuGestureOptions {
  /** Opens the menu at a screen point. */
  open: (at: Position) => void;
  /** Whether the menu may open at all, say not while attaching. */
  canOpen: () => boolean;
  /** Whether a touch hold opens it: not in selection mode, where it draws a box. */
  canHold: () => boolean;
}

/**
 * Tells a press that opens the board menu from one that pans or draws a box:
 * a right-click that doesn't move (a right-drag pans), or one finger held
 * still. The board says whether each press started on empty board.
 */
export function createMenuGesture({
  open,
  canOpen,
  canHold,
}: MenuGestureOptions) {
  // Fingers and pens down now, to cancel a hold when a second one lands.
  const touching = new Set<number>();
  let hold: { id: number; x: number; y: number } | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let right: { id: number; x: number; y: number; moved: boolean } | null = null;
  let held = false;

  const farFrom = (e: MenuPress, start: { x: number; y: number }) =>
    Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP;

  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = undefined;
    hold = null;
  }

  function down(e: MenuPress, onEmptyBoard: boolean) {
    held = false;
    if (e.pointerType === 'mouse') {
      right =
        e.button === 2 && onEmptyBoard
          ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
          : null;
      return;
    }
    touching.add(e.pointerId);
    cancelHold();
    if (touching.size > 1 || !onEmptyBoard || !canOpen() || !canHold()) return;
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    hold = start;
    holdTimer = setTimeout(() => {
      hold = null;
      if (!canOpen() || !canHold()) return;
      held = true;
      navigator.vibrate?.(10);
      open({ x: start.x, y: start.y });
    }, LONG_PRESS_MS);
  }

  function move(e: MenuPress) {
    if (hold && e.pointerId === hold.id && farFrom(e, hold)) cancelHold();
    if (right && e.pointerId === right.id && farFrom(e, right))
      right.moved = true;
  }

  function end(e: MenuPress) {
    touching.delete(e.pointerId);
    if (hold?.id === e.pointerId) cancelHold();
  }

  function up(e: MenuPress) {
    end(e);
    const press = right;
    if (!press || e.pointerId !== press.id || e.button !== 2) return;
    right = null;
    if (!press.moved && !farFrom(e, press) && canOpen())
      open({ x: e.clientX, y: e.clientY });
  }

  function cancel(e: MenuPress) {
    end(e);
    if (right?.id === e.pointerId) right = null;
  }

  return {
    down,
    move,
    up,
    cancel,
    /** Whether the last press opened the menu by holding, so isn't a tap. */
    get held() {
      return held;
    },
    dispose: cancelHold,
  };
}

/** A command in the board menu, under the name it has there. */
export interface BoardMenuItem {
  cmd: WidgetCommand;
  label?: string;
}

// Groups of slots. A slot shows the first of its commands that applies, so
// Select all turns into Deselect all once everything is selected.
const MENU: { id: string; label?: string }[][][] = [
  [
    [{ id: 'onDeck.cast', label: 'Cast On-deck card here' }],
    [{ id: 'addCard.open', label: 'Add card…' }],
  ],
  [
    [{ id: 'arrange.smart' }],
    [{ id: 'board.zoomToFit', label: 'Zoom to fit' }],
    [{ id: 'board.resetView' }],
  ],
  [[{ id: 'select.all' }, { id: 'selection.clear', label: 'Deselect all' }]],
];

/** The board menu's commands that apply now, in its groups, none empty. */
export function boardMenuGroups(
  commands: readonly WidgetCommand[],
): BoardMenuItem[][] {
  const byId = new Map(commands.map((c) => [c.id, c]));
  return MENU.map((group) =>
    group.flatMap((slot) => {
      for (const { id, label } of slot) {
        const cmd = byId.get(id);
        if (cmd && commandApplies(cmd)) return [{ cmd, label }];
      }
      return [];
    }),
  ).filter((g) => g.length);
}
