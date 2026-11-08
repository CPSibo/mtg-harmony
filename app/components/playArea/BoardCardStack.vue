<template>
  <div
    ref="stack"
    :style="style"
    class="board-card-stack origin-top-left absolute"
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
import PlayAreaBoardCard from '~/components/playArea/BoardCard.vue';
import PlayAreaBoardCardStackActions from '~/components/playArea/BoardCardStackActions.vue';
import { useBoardDraggable } from '~/composables/useScaledDraggable';
import { storeToRefs } from 'pinia';
import { useTemplateRef, watch } from 'vue';
import type { Position } from '@vueuse/core';
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

const isDragging = defineModel<boolean>('isDragging');

const props = defineProps<{
  board: HTMLDivElement;
  scale: number;
  stack: BoardCardStack;
}>();

const emits = defineEmits<{
  showCardDetails: [BoardCard];
  showCardModifiers: [BoardCard];
}>();

const battlefield = useBattlefieldStore();
const { snapScale } = storeToRefs(battlefield);

const stackEl = useTemplateRef('stack');

const { style, isDragging: myIsDragging } = useBoardDraggable(stackEl, {
  scale: () => props.scale,
  snapScale: snapScale,
  containerElement: props.board,
  initialValue: {
    x: props.stack.position.x,
    y: props.stack.position.y,
  },
  preventDefault: true,
  stopPropagation: false,
  capture: true,
  disabled: () => battlefield.isAttaching,
  onEnd: (position: Position) => {
    battlefield.setStackPosition(props.stack, position);
  },
});

watch(myIsDragging, (value) => {
  isDragging.value = value;

  battlefield.bringToFront(props.stack);
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
