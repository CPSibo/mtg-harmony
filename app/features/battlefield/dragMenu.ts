import { ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue';
import { useSettingsStore } from '~/stores/settings';
import { DRAG_MENU_DELAY_MS } from './dragMenuDelay';
import type { AttachMode } from './store';

export {
  DRAG_MENU_DELAY_MS,
  isDragMenuDelay,
  MAX_DRAG_MENU_DELAY_MS,
  MIN_DRAG_MENU_DELAY_MS,
} from './dragMenuDelay';

/** What is under the pointer during a drag. */
export interface DragMenuHit {
  /** A stack whose primary card the pointer is over. */
  stackId?: string;
  /** A menu option the pointer is over. */
  option?: AttachMode;
  /** Whether the pointer is inside the open menu's area: its stack and the menu. */
  inArea?: boolean;
}

/**
 * The radial menu a single dragged card opens over another stack (#108).
 * Hovering over a stack's primary for `delay` ms (read as each hover
 * starts) opens the menu around it, and dropping on an option picks it.
 * Leaving the menu's area for `delay` ms closes it again, and the card
 * under the pointer then starts its own wait.
 * Holds no DOM: the caller says what the pointer is over.
 */
export function createDragMenu(
  delay: MaybeRefOrGetter<number> = DRAG_MENU_DELAY_MS,
) {
  /** The stack the menu is open around. Read by the board to render it. */
  const target = shallowRef<string | null>(null);
  /** The option under the pointer, highlighted while dragging. */
  const hovered = ref<AttachMode | null>(null);

  let eligible = false;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Closes the open menu once the pointer has been outside it a while. */
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastHit: DragMenuHit = {};

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
  }

  function clearLeaveTimer() {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }

  function close() {
    clearLeaveTimer();
    target.value = null;
    hovered.value = null;
    // Whatever the pointer is over now starts its own wait.
    move(lastHit);
  }

  function start(canOpen: boolean) {
    end();
    eligible = canOpen;
  }

  function move(hit: DragMenuHit) {
    if (!eligible) return;
    lastHit = hit;
    if (target.value) {
      hovered.value = hit.option ?? null;
      if (hit.option || hit.inArea) clearLeaveTimer();
      else leaveTimer ??= setTimeout(close, toValue(delay));
      return;
    }
    const stackId = hit.stackId ?? null;
    if (stackId === pending) return;
    clearTimer();
    if (!stackId) return;
    pending = stackId;
    timer = setTimeout(() => {
      target.value = stackId;
      clearTimer();
    }, toValue(delay));
  }

  /** Ends the drag: the picked option, or null for a normal move. */
  function end(): { stackId: string; mode: AttachMode } | null {
    const picked =
      target.value && hovered.value
        ? { stackId: target.value, mode: hovered.value }
        : null;
    clearTimer();
    clearLeaveTimer();
    lastHit = {};
    eligible = false;
    target.value = null;
    hovered.value = null;
    return picked;
  }

  return { target, hovered, start, move, end };
}

/** The board's one menu; only one card is dragged at a time. */
export const dragMenu = createDragMenu(() => useSettingsStore().dragMenuDelay);
