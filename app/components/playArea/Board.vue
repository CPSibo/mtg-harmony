<template>
  <div
    class="board-wrapper"
    :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
    @touchstart.stop.prevent="guardedTouchStart"
    @touchmove.stop.prevent="guardedTouchMove"
    @touchend.stop.prevent="guardedTouchEnd"
  >
    <div
      ref="board"
      class="board"
      :style="style"
    >
      <SharedGrid>
        <LazyPlayAreaBoardCardStack
          v-for="stack in stacks"
          v-if="!!boardEl"
          :key="stack.id"
          v-model:is-dragging="anyCardIsDragging"
          :stack="stack"
          :board="boardEl"
          :scale="scale"
          @show-card-details="showCardDetails"
          @show-card-modifiers="showCardModifiers"
        />
      </SharedGrid>
    </div>
  </div>

  <PlayAreaCardDetails
    v-model:open="cardDetailsIsOpen"
    :card="selectedCard"
    @show-card-modifiers="showCardModifiers"
  />

  <PlayAreaModifiersMenu
    v-model:open="cardModifiersIsOpen"
    :card="selectedCard"
  />

  <WidgetsAddCard v-model:open="addCardsIsOpen" />
</template>

<script setup lang="ts">
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

import { onKeyPressed } from '@vueuse/core';

const battlefield = useBattlefield();
const { stacks, center: centerState } = storeToRefs(battlefield);

const boardEl = useTemplateRef('board');

const {
  center,
  scale,
  style,
  isDragging,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
} = usePanAndZoom({
  size: { width: 5000, height: 5000 },
  onEnd: () => {
    // Performance consideration.
    // Watching the center directly does bad
    // stuff, even with `save` being debounced.
    centerState.value = center.value;
  },
  disabled: () => battlefield.isAttaching,
});

const anyCardIsDragging = ref(false);

function guardedTouchStart(e: TouchEvent) {
  if (anyCardIsDragging.value) return;
  onTouchStart(e);
}
function guardedTouchMove(e: TouchEvent) {
  if (anyCardIsDragging.value) return;
  onTouchMove(e);
}
function guardedTouchEnd(e: TouchEvent) {
  if (anyCardIsDragging.value) return;
  onTouchEnd(e);
}

const selectedCard = ref<BoardCard | undefined>();

const cardDetailsIsOpen = ref(false);

const showCardDetails = (card: BoardCard) => {
  selectedCard.value = card;
  cardModifiersIsOpen.value = false;
  cardDetailsIsOpen.value = true;
};

const cardModifiersIsOpen = ref(false);

const showCardModifiers = (card: BoardCard) => {
  selectedCard.value = card;
  cardDetailsIsOpen.value = false;
  cardModifiersIsOpen.value = true;
};

const addCardsIsOpen = ref(false);

// const stackClicked = (card: BoardCard, stack: BoardCardStack) => {
//   if (!attachSourceCard.value || !attachSourceStack.value) return;

//   if (attachSourceCard.value !== attachSourceStack.value.primary) {
//     if (attachSourceStack.value.attachments.length > 0) {
//       const nextPrimary = attachSourceStack.value.attachments[0]!;
//       attachSourceStack.value.primary = nextPrimary;
//       attachSourceStack.value.attachments =
//         attachSourceStack.value.attachments.filter((f) => f !== nextPrimary);
//     }
//   } else {
//     stacks.value = stacks.value.filter((f) => f !== attachSourceStack.value);
//   }

//   stack.attachments.push(attachSourceCard.value);

//   attachSourceStack.value = undefined;
//   attachSourceCard.value = undefined;
// };

const detachRequested = (card: BoardCard, stack: BoardCardStack) => {
  if (!card || !stack) return;

  if (!stack.attachments?.includes(card)) return;

  stack.attachments = stack.attachments.filter((f) => f !== card);

  battlefield.addStackByCard(card);

  cardDetailsIsOpen.value = false;
};

onKeyPressed('\\', (e) => {
  e.preventDefault();
  e.stopPropagation();

  addCardsIsOpen.value = true;
});
</script>

<style lang="css" scoped>
.board-wrapper {
  width: 100svw;
  height: 100svh;
  position: relative;
  overflow: hidden;
  contain: strict; /* Disable CLS hints for children. */
}

.board {
  position: absolute;
  transform-origin: 0 0;
  user-select: none;
}
</style>
