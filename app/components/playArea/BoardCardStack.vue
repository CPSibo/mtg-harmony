<template>
  <div
    ref="stack"
    :data-stack-id="stack.id"
    :style="[style, { zIndex: battlefield.stackZIndex.get(stack.id) ?? 0 }]"
    class="board-card-stack origin-top-left absolute top-0 left-0"
    :class="{ dragging: myIsDragging }"
  >
    <!-- Cards under the primary peek out above it, newest on top. -->
    <div
      class="unders"
      :class="{ 'primary-tapped': stack.primary.tapped }"
    >
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

    <div class="primary-card-wrapper flex flex-row">
      <PlayAreaBoardCardStackActions
        :stack="stack"
        @show-card-details="emits('showCardDetails', $event)"
      />

      <PlayAreaBoardCard
        class="primary-card"
        :card="stack.primary"
        :data-drag-target="stack.id"
        :stack="stack"
        @show-card-details="emits('showCardDetails', stack.primary)"
        @show-card-modifiers="emits('showCardModifiers', stack.primary)"
      />
    </div>

    <div
      class="attachments"
      :style="`--total: ${stack.attachments.size}`"
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
import { onUnmounted, useTemplateRef, watch } from 'vue';
import type { Position } from '@vueuse/core';
import {
  dragMenu,
  useBattlefieldStore,
  type AttachMode,
  type DragMenuHit,
} from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
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
const settings = useSettingsStore();
const animateMove = useMoveAnimation();
const { snapScale } = storeToRefs(battlefield);

const stackEl = useTemplateRef('stack');

const { style, isDragging: myIsDragging } = useBoardDraggable(stackEl, {
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
  onStart: () => dragMenu.start(true),
  onMove: (e) => dragMenu.move(hitAt(e)),
  onEnd: (position: Position, e) => {
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
  },
});

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
onUnmounted(() => battlefield.forgetStackSize(props.stack.id));

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

.primary-card {
  position: relative;
  z-index: 1;
}

/* Behind the primary and the attachments, centred on the primary's width. */
.unders {
  position: absolute;
  top: 0;
  left: var(--actions-total-width);
  width: var(--w);
  z-index: -1;

  &.primary-tapped {
    width: var(--h);
  }

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

  /* Need to cap the height, or else the `top` makes a big, invisible chin. */
  /* TODO: This doesn't account for tapped attachments. */
  height: calc((var(--total) * var(--h)) + var(--vertical-offset));

  > .board-card {
    top: calc(var(--vertical-offset) * var(--index));
    z-index: calc(var(--index) * -1);
    position: relative;
  }
}
</style>
