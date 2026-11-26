<template>
  <div
    ref="stack"
    :data-stack-id="stack.id"
    :style="[
      style,
      followStyle,
      { zIndex: battlefield.stackZIndex.get(stack.id) ?? 0 },
    ]"
    class="board-card-stack origin-top-left absolute top-0 left-0"
    :class="{
      dragging: myIsDragging || following,
      selected: selection.has(stack.id),
    }"
    @focusin="onFocusIn"
  >
    <!-- Cards under the primary peek out above it, newest on top. -->
    <div class="unders">
      <PlayAreaBoardCard
        v-for="(card, index) in stack.unders"
        :key="card.id"
        :card="card"
        class="under"
        :style="`--index: ${index}`"
        @show-card-details="emits('showCardDetails', card)"
        @show-card-modifiers="emits('showCardModifiers', card)"
      />
    </div>

    <div
      class="primary-card-wrapper flex flex-row"
      :class="{ 'primary-sideways': primarySideways }"
    >
      <!-- The card comes first so Tab reaches it, then its actions; the
           actions still sit to its left (order: -1). #170 -->
      <PlayAreaBoardCard
        class="primary-card"
        :card="stack.primary"
        :data-drag-target="stack.id"
        :stack="stack"
        @show-card-details="emits('showCardDetails', stack.primary)"
        @show-card-modifiers="emits('showCardModifiers', stack.primary)"
      />

      <PlayAreaBoardCardStackActions
        :stack="stack"
        @show-card-details="emits('showCardDetails', $event)"
      />
    </div>

    <div
      class="attachments"
      :style="{
        '--total': stack.attachments.size,
        '--sideways': sidewaysAttachments,
      }"
    >
      <PlayAreaBoardCard
        v-for="(card, index) in stack.attachments"
        :key="card.id"
        :card="card"
        :stack="stack"
        class="attachment"
        :style="`--index: ${index}`"
        @show-card-details="emits('showCardDetails', card)"
        @show-card-modifiers="emits('showCardModifiers', card)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMoveAnimation } from '~/features/castAnimation';
import PlayAreaBoardCard from '~/components/playArea/BoardCard.vue';
import PlayAreaBoardCardStackActions from '~/components/playArea/BoardCardStackActions.vue';
import { useBoardDraggable } from '~/composables/useScaledDraggable';
import { storeToRefs } from 'pinia';
import { useResizeObserver } from '@vueuse/core';
import { computed, onUnmounted, useTemplateRef, watch } from 'vue';
import type { Position } from '@vueuse/core';
import {
  dragMenu,
  useBattlefieldStore,
  type AttachMode,
  type DragMenuHit,
  useSelectionStore,
} from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { LONG_PRESS_MS, PRESS_SLOP } from '~/utils/press';
import { isLandscape } from '~/features/battlefield/cardFaces';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

const isDragging = defineModel<boolean>('isDragging');

const props = defineProps<{
  board: HTMLDivElement;
  stack: BoardCardStack;
}>();

const emits = defineEmits<{
  showCardDetails: [BoardCard];
  showCardModifiers: [BoardCard];
}>();

const battlefield = useBattlefieldStore();
const primarySideways = computed(
  () => isLandscape(props.stack.primary) !== props.stack.primary.tapped,
);
/** Attachments lying on their long side, which are only a card's width tall. */
const sidewaysAttachments = computed(() => {
  let count = 0;
  for (const card of props.stack.attachments)
    if (isLandscape(card) !== card.tapped) count++;
  return count;
});
const settings = useSettingsStore();
const selection = useSelectionStore();
const animateMove = useMoveAnimation();
const { snapScale } = storeToRefs(battlefield);

const stackEl = useTemplateRef('stack');

// The press's state; only the handlers read it.
let pressStart: Position = { x: 0, y: 0 };
let positionAtStart: Position = { x: 0, y: 0 };
let movedTooFar = false;
let longPressed = false;
let longPressTimer: ReturnType<typeof setTimeout> | undefined;
let groupDrag = false;

function cancelLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

const {
  x,
  y,
  style,
  isDragging: myIsDragging,
} = useBoardDraggable(stackEl, {
  // Read when a drag moves, so zooming doesn't re-render every stack.
  scale: () => battlefield.boardScale(),
  snapScale: snapScale,
  // Snap the primary card's corner, not the stack's, so its edges sit on the
  // grid lines whatever the action buttons and unders add around it (#116).
  snapOffset: () => {
    const stack = stackEl.value;
    const card = stack?.querySelector('.primary-card');
    if (!stack || !card) return { x: 0, y: 0 };
    const s = battlefield.boardScale();
    const a = stack.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    return { x: (b.left - a.left) / s, y: (b.top - a.top) / s };
  },
  containerElement: props.board,
  initialValue: {
    x: props.stack.position.x,
    y: props.stack.position.y,
  },
  disabled: () => battlefield.isAttaching,
  smoothing: () => settings.pointerSmoothing,
  // A single card held over another stack opens the radial menu (#108).
  onStart: (e) => {
    pressStart = { x: e.clientX, y: e.clientY };
    positionAtStart = { x: x.value, y: y.value };
    movedTooFar = false;
    longPressed = false;
    // Several selected stacks move together, and drop on nothing (#138).
    groupDrag = selection.startGroupDrag(props.stack.id);
    dragMenu.start(!groupDrag);
    if (e.pointerType === 'touch')
      longPressTimer = setTimeout(() => {
        longPressed = true;
        selection.setMode(true);
        selection.add(props.stack.id);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
  },
  onMove: (e) => {
    if (
      !movedTooFar &&
      Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) >
        PRESS_SLOP
    ) {
      movedTooFar = true;
      cancelLongPress();
    }
    if (!groupDrag) dragMenu.move(hitAt(e));
  },
  onEnd: (position: Position, e) => {
    cancelLongPress();
    if (groupDrag) {
      groupDrag = false;
      dragMenu.end();
      battlefield.setStackPosition(props.stack, position);
      selection.moveGroup(offsetFromStart(position));
      selection.endGroupDrag();
    } else {
      // Moving a stack that isn't selected is outside selection mode (#235).
      if (movedTooFar && !selection.has(props.stack.id))
        selection.setMode(false);
      onSingleDrop(position, e);
    }
    if (!movedTooFar && !longPressed && e.type === 'pointerup') onTap(e);
  },
  // This stack left the board mid-drag (#160). The watch on `myIsDragging`
  // is already stopped, so tell the board directly, and let the group and
  // the radial menu go.
  onCancel: () => {
    cancelLongPress();
    dragMenu.end();
    if (groupDrag) {
      groupDrag = false;
      selection.endGroupDrag();
    }
    isDragging.value = false;
  },
});

function offsetFromStart(p: Position): Position {
  return { x: p.x - positionAtStart.x, y: p.y - positionAtStart.y };
}

/**
 * Ctrl/Cmd/Shift-click, or a tap in selection mode, toggles the stack. A
 * plain tap selects just this stack (#216): it's the target for selection
 * commands in the palette.
 */
function onTap(e: PointerEvent) {
  const modified = e.ctrlKey || e.metaKey || e.shiftKey;
  // The stack's own buttons keep working, and don't select it.
  if (!modified && (e.target as Element | null)?.closest('button')) return;
  if (modified || selection.mode) selection.toggle(props.stack.id);
  else selection.selectOnly(props.stack.id);
}

/**
 * Tab onto one of the stack's cards selects the stack, as a tap does. Mouse
 * focus left by a click or a drag doesn't (`:focus-visible` is keyboard
 * focus), and neither does Tab while several stacks are selected or in
 * selection mode, so a selection being built isn't lost.
 */
function onFocusIn(e: FocusEvent) {
  const target = e.target as Element | null;
  if (!target?.matches('.card-image:focus-visible')) return;
  if (selection.mode || selection.size > 1) return;
  selection.selectOnly(props.stack.id);
}

// The leader's eased position drives the group, so the followers keep pace.
watch([x, y], () => {
  if (selection.leader === props.stack.id)
    selection.moveGroup(offsetFromStart({ x: x.value, y: y.value }));
});

/** Whether another selected stack's drag carries this one along. */
const following = computed(() => selection.follows(props.stack.id));
// Only followers read the offset, so a group drag re-renders just them.
const followStyle = computed(() => {
  if (!following.value) return undefined;
  const { x: dx, y: dy } = selection.groupOffset;
  return `transform: translate(${x.value + dx}px, ${y.value + dy}px);`;
});

// A position set from outside this stack's drag (as a follower) moves it.
watch(
  () => props.stack.position,
  (p) => {
    x.value = p.x;
    y.value = p.y;
  },
);

function onSingleDrop(position: Position, e: PointerEvent) {
  const picked = dragMenu.end();
  const target =
    picked && e.type === 'pointerup'
      ? battlefield.stacks.find((s) => s.id === picked.stackId)
      : undefined;
  if (picked && target) {
    const card = props.stack.primary;
    // Measured where it was dropped (#124).
    const play = animateMove([card.id]);
    battlefield.dropCardOn(card, target, picked.mode);
    play(target.primary.id, true);
  } else battlefield.setStackPosition(props.stack, position);
}

/** The menu option, or another stack's primary, under the pointer. */
function hitAt(e: PointerEvent): DragMenuHit {
  const hit = findHit(e);
  const open = dragMenu.target.value;
  if (open && !hit.option) hit.inArea = inMenuArea(open, e);
  return hit;
}

/**
 * Whether the pointer is inside the bounding box of the open menu's stack
 * and the menu together. Measured per move only while the menu is open.
 */
function inMenuArea(stackId: string, e: PointerEvent) {
  const parts = [
    document.querySelector(`[data-stack-id="${CSS.escape(stackId)}"]`),
    ...document.querySelectorAll('[data-drag-menu-option]'),
  ]
    .filter((el) => !!el)
    .map((el) => el.getBoundingClientRect());
  if (!parts.length) return false;
  const left = Math.min(...parts.map((r) => r.left));
  const right = Math.max(...parts.map((r) => r.right));
  const top = Math.min(...parts.map((r) => r.top));
  const bottom = Math.max(...parts.map((r) => r.bottom));
  return (
    e.clientX >= left &&
    e.clientX <= right &&
    e.clientY >= top &&
    e.clientY <= bottom
  );
}

function findHit(e: PointerEvent): DragMenuHit {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    const option = el.closest<HTMLElement>('[data-drag-menu-option]')?.dataset
      .dragMenuOption;
    if (option) return { option: option as AttachMode };

    const id =
      el.closest<HTMLElement>('[data-drag-target]')?.dataset.dragTarget;
    if (!id || id === props.stack.id) continue;
    const target = battlefield.stacks.find((s) => s.id === id);
    if (target && battlefield.canOfferDragMenu(props.stack, target))
      return { stackId: id };
    return {};
  }
  return {};
}

// Layout size, unaffected by the board's zoom, so in board pixels. New cards
// are placed clear of it (#78).
useResizeObserver(stackEl, () => {
  const el = stackEl.value;
  if (!el) return;
  battlefield.setStackSize(props.stack.id, {
    width: el.offsetWidth,
    height: el.offsetHeight,
  });
});
onUnmounted(() => {
  cancelLongPress();
  battlefield.forgetStackSize(props.stack.id);
});

watch(myIsDragging, (value) => {
  isDragging.value = value;
  if (value) battlefield.bringToFront(props.stack);
});
</script>

<style lang="scss" scoped>
.board-card-stack {
  --scale: 0.35;
  --border-width: 2px;
  --scaled-short: calc(var(--card-short-side) * var(--scale));
  --scaled-long: calc(var(--card-long-side) * var(--scale));
  --w: calc(var(--scaled-short) + var(--border-width) * 2);
  --h: calc(var(--scaled-long) + var(--border-width) * 2);

  --actions-width: 1.5em;
  --actions-padding-right: 0.3em;
  --actions-total-width: calc(
    var(--actions-width) + var(--actions-padding-right)
  );

  isolation: isolate;

  /* Its own GPU layer while dragged, so moving it doesn't repaint the board. */
  &.dragging {
    will-change: transform;
  }

  .primary-card-wrapper {
    position: relative;
    z-index: 1;
  }
}

/* A selected stack rings its primary card, turning with it (#138). */
.board-card-stack.selected .primary-card :deep(.card-image) {
  box-shadow:
    0 0 0 3px var(--ui-primary),
    0 0 12px 3px color-mix(in oklab, var(--ui-primary) 60%, transparent);
}

.primary-card {
  position: relative;
  z-index: 1;
}

/* A sideways primary (tapped, or landscape) lies in place: it keeps its untapped width, overhanging
   both sides evenly, so it stays centred on the stack (#127). It still gives
   up the height it no longer covers, so the attachments ride up under it. */
.board-card-stack .primary-card.sideways :deep(.card-image-wrapper) {
  width: var(--w);
}

/* Counters step right past the overhang. */
.board-card-stack .primary-card.sideways :deep(.modifiers) {
  left: calc(100% + (var(--h) - var(--w)) / 2 + 0.3em);
}

/* The actions step left by the overhang so the tapped card doesn't cover them. */
.primary-card-wrapper :deep(.stack-actions) {
  order: -1;
  transition: translate 180ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.primary-card-wrapper.primary-sideways :deep(.stack-actions) {
  translate: calc((var(--w) - var(--h)) / 2) 0;
}

/* Behind the primary and the attachments, centred on the primary's width. */
.unders {
  position: absolute;
  top: 0;
  left: var(--actions-total-width);
  width: var(--w);
  z-index: -1;

  > .board-card {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    top: calc(var(--h) * -0.12 * (var(--index) + 1));
    z-index: calc(var(--index) * -1);
  }

  :deep(.modifiers) {
    display: none;
  }
}

.attachments {
  --vertical-offset: calc(var(--h) * -0.56);

  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: column;
  place-items: center;
  top: var(--vertical-offset);
  margin-left: var(--actions-total-width);
  /* The primary's width, so a wider tapped attachment overflows both sides
     evenly and stays centred on the primary (#127). */
  width: var(--w);

  /* Cap the height at where the last card ends, or the offsets leave a big,
     invisible chin (#186). Each card is a card's height tall, or its width
     when it lies sideways, and each rides up by the offset. */
  height: calc(
    (var(--total) - var(--sideways)) * var(--h) + var(--sideways) * var(--w) +
      var(--total) * var(--vertical-offset)
  );

  > .board-card {
    top: calc(var(--vertical-offset) * var(--index));
    z-index: calc(var(--index) * -1);
    position: relative;
  }
}
</style>
