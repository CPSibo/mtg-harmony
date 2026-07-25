<template>
  <div
    ref="stack"
    :style="style"
    :class="[
      'board-card-stack origin-top-left absolute',
      { 'primary-tapped': stack.primary.tapped },
    ]"
  >
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
      :class="{ 'primary-tapped': stack.primary.tapped }"
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
  clicked: [BoardCard, BoardCardStack];
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
    props.stack.position = position;
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

  --actions-margin: 1.5em;
  --actions-width: 1.5em;
  --actions-padding-right: 0.3em;
  --actions-total-width: calc(
    var(--actions-width) + var(--actions-padding-right)
  );

  // margin-left: var(--actions-margin);

  background:green;

  .primary-card-wrapper {
    position: relative;
    z-index: 1;
  }
}

.primary-card {
  position: relative;
  z-index: 1;
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

  &.primary-tapped {
    // margin-left: 60px + var(--actions-margin);
  }

  > .board-card {
    top: calc(var(--vertical-offset) * var(--index));
    z-index: calc(var(--index) * -1);
    position: relative;
  }
}

.board-card-stack:hover {
  // margin-left: 0;

  &.primary-tapped {
    .primary-card {
      // margin-left: 60px + var(--actions-margin);
    }
  }

  .attachments {
    // margin-left: var(--actions-margin);
  }
}
</style>
