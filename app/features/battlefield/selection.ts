import { defineStore } from 'pinia';
import { computed, ref, shallowRef, triggerRef } from 'vue';
import type { Position } from '@vueuse/core';
import { BOARD_SIZE, overlaps, type Rect } from './placement';
import { useBattlefieldStore } from './store';
import type { BoardCardStack } from '~/types/PlayArea';

/**
 * Which stacks are selected (#138), whether selection mode is on, and the
 * offset of a group drag in progress. Not saved: a selection is a moment's
 * intent, not board state.
 */
export const useSelectionStore = defineStore('selection', () => {
  const battlefield = useBattlefieldStore();

  // Replaced or changed in place and triggered; stacks read it to show a ring.
  const selected = shallowRef(new Set<string>());
  /** Taps toggle stacks and a drag on the empty board draws a box. */
  const mode = ref(false);

  /** Selected IDs of stacks still on the board, in board order. */
  const idList = computed(() =>
    battlefield.stacks.filter((s) => selected.value.has(s.id)).map((s) => s.id),
  );
  const size = computed(() => idList.value.length);

  const ids = () => idList.value;
  /** The selected stacks, in board order: what selection commands act on. */
  const stacks = () => {
    const chosen = new Set(idList.value);
    return battlefield.stacks.filter((s) => chosen.has(s.id));
  };
  const has = (id: string) => selected.value.has(id);

  function replace(next: Set<string>) {
    selected.value = next;
  }

  function toggle(id: string) {
    if (!selected.value.delete(id)) selected.value.add(id);
    triggerRef(selected);
  }

  function add(id: string) {
    if (selected.value.has(id)) return;
    selected.value.add(id);
    triggerRef(selected);
  }

  /** Selects just this stack (a plain tap or Tab, #216). */
  function selectOnly(id: string) {
    if (selected.value.size === 1 && selected.value.has(id)) return;
    replace(new Set([id]));
  }

  function clear() {
    if (selected.value.size) replace(new Set());
  }

  // ─── Building a selection (#220) ──────────────────────────────────────────

  /** Selects just the stacks `pick` accepts. */
  function selectWhere(pick: (stack: BoardCardStack) => boolean) {
    replace(new Set(battlefield.stacks.filter(pick).map((s) => s.id)));
  }

  function selectAll() {
    selectWhere(() => true);
  }

  function invert() {
    const was = new Set(idList.value);
    selectWhere((s) => !was.has(s.id));
  }

  /** Selects the stacks whose card is tapped, or untapped. */
  function selectTapped(tapped: boolean) {
    selectWhere((s) => !!s.primary.tapped === tapped);
  }

  /** Adds every stack whose card is named like a selected stack's card. */
  function selectSameName() {
    const names = new Set(stacks().map((s) => s.primary.scryfallInfo.name));
    selectWhere((s) => names.has(s.primary.scryfallInfo.name));
  }

  function setMode(value: boolean) {
    mode.value = value;
  }

  /** Esc: the first press clears the selection, the next leaves the mode. */
  function escape() {
    if (size.value) clear();
    else mode.value = false;
  }

  /** Selects the stacks a board-pixel box touches. */
  function selectInRect(rect: Rect, additive: boolean) {
    const next = additive ? new Set(idList.value) : new Set<string>();
    for (const stack of battlefield.stacks) {
      const box = { ...stack.position, ...battlefield.stackSize(stack) };
      if (overlaps(rect, box)) next.add(stack.id);
    }
    replace(next);
  }

  // ─── Group drag ────────────────────────────────────────────────────────────
  // Every frame of a group drag sets the offset, so only the selected
  // stacks that follow it read it.

  /** How far the stack being dragged has moved; the others add it. */
  const groupOffset = ref<Position>({ x: 0, y: 0 });
  /** The stack being dragged, which moves itself. */
  const leader = ref<string | null>(null);

  /** Starts moving the selection with `id`, if it's one of several selected. */
  function startGroupDrag(id: string): boolean {
    if (!has(id) || size.value < 2) return false;
    leader.value = id;
    groupOffset.value = { x: 0, y: 0 };
    // Front in their current order, the leader last.
    for (const s of battlefield.orderedStacks)
      if (has(s.id) && s.id !== id) battlefield.bringToFront(s);
    return true;
  }

  function moveGroup(offset: Position) {
    groupOffset.value = offset;
  }

  /** Writes the followers' new positions, kept on the board. */
  function endGroupDrag() {
    const { x: dx, y: dy } = groupOffset.value;
    for (const stack of battlefield.stacks) {
      if (stack.id === leader.value || !has(stack.id)) continue;
      const { width, height } = battlefield.stackSize(stack);
      const clamp = (v: number, hi: number) => Math.min(Math.max(v, 0), hi);
      battlefield.setStackPosition(stack, {
        x: clamp(stack.position.x + dx, BOARD_SIZE.width - width),
        y: clamp(stack.position.y + dy, BOARD_SIZE.height - height),
      });
    }
    leader.value = null;
    groupOffset.value = { x: 0, y: 0 };
  }

  /** Whether `id` is moved along by another stack's drag right now. */
  const follows = (id: string) =>
    leader.value !== null && leader.value !== id && has(id);

  return {
    mode,
    size,
    ids,
    stacks,
    has,
    selectOnly,
    toggle,
    add,
    clear,
    replace,
    selectWhere,
    selectAll,
    invert,
    selectTapped,
    selectSameName,
    setMode,
    escape,
    selectInRect,
    groupOffset,
    leader,
    startGroupDrag,
    moveGroup,
    endGroupDrag,
    follows,
  };
});
