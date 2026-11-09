import type { Position } from '@vueuse/core';
import { ref } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';

/** How far the pointer moves before a press becomes a drag, in screen px. */
const DRAG_THRESHOLD = 6;

/** A card's width on the board, in board px (BoardCard at the stack's scale). */
export const BOARD_CARD_WIDTH = 172;

export interface DragToCastOptions {
  /** Called with the board point the card was dropped on. */
  onDrop: (at: Position) => void;
}

/**
 * Drags a card from outside the board onto it (#79, #113). Bind the handlers
 * to the card, and show a ghost at `ghost` (its centre, in screen px) and
 * `ghostWidth` while one is set. A press that doesn't move is a tap and is
 * left alone; the click that follows a drag is swallowed, so a drag never
 * also counts as a tap.
 */
export function useDragToCast({ onDrop }: DragToCastOptions) {
  const board = useBattlefieldStore();

  let pressedAt: (Position & { id: number }) | null = null;

  /** Where the ghost's centre is, in screen px, while dragging. */
  const ghost = ref<Position | null>(null);

  // The size the card will land at, so the drop matches what's shown. Set as
  // a drag starts; the board can't zoom during one.
  const ghostWidth = ref(BOARD_CARD_WIDTH);

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    pressedAt = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pressedAt || e.pointerId !== pressedAt.id) return;
    const moved = Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y);
    if (!ghost.value && moved < DRAG_THRESHOLD) return;
    if (!ghost.value) ghostWidth.value = BOARD_CARD_WIDTH * board.boardScale();
    ghost.value = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: PointerEvent) {
    if (!pressedAt || e.pointerId !== pressedAt.id) return;
    const dropped = ghost.value;
    cancelDrag();
    if (!dropped) return; // A tap, not a drag.

    swallowNextClick();

    // Back where it came from, or off the board, cancels.
    const under = document.elementFromPoint(dropped.x, dropped.y);
    if (!under?.closest('.board-wrapper')) return;

    const at = board.boardPointFromScreen(dropped);
    if (at) onDrop(at);
  }

  function cancelDrag() {
    pressedAt = null;
    ghost.value = null;
  }

  return {
    ghost,
    ghostWidth,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  };
}

/**
 * Stops the click a drag's pointerup produces from reaching anything, such as
 * a list item that selects on click. The browser fires it straight after
 * pointerup, if at all, so the listener drops itself on the next task.
 */
function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    remove();
  };
  const remove = () => window.removeEventListener('click', stop, true);
  window.addEventListener('click', stop, true);
  setTimeout(remove, 0);
}
