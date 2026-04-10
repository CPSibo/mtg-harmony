<template>
  <div
    ref="stack"
    :style="style"
    class="board-card-stack origin-top-left absolute"
  >
    <div class="flex flex-row">
      <div
        class="stack-actions flex flex-col gap-2"
        :class="{ tapped: stack.primary.tapped }"
      >
        <UButton
          color="primary"
          size="xs"
          variant="soft"
          :disabled="battlefield.isAttaching"
          @click="stack.primary.tapped = !stack.primary.tapped"
        >
          <span
            class="ms"
            :class="{
              'ms-untap': stack.primary.tapped,
              'ms-tap': !stack.primary.tapped,
            }"
          />
        </UButton>

        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          size="xs"
          variant="soft"
          :disabled="battlefield.isAttaching"
          @click="emits('showCardDetails', stack.primary)"
        />

        <UDropdownMenu
          :items="[
            {
              label: 'Copy card',
              icon: 'i-lucide-copy',
              color: 'primary',
            },
            {
              label: 'Copy card + counters',
              icon: 'i-lucide-copy-plus',
            },
            {
              label: 'Copy everything',
              icon: 'i-lucide-square-stack',
            },
          ]"
          :content="{
            align: 'start',
            side: 'bottom',
          }"
          size="xl"
        >
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            size="xs"
            variant="soft"
            :disabled="battlefield.isAttaching"
          />
        </UDropdownMenu>

        <UDropdownMenu
          :items="[
            {
              label: 'Destroy',
              icon: 'i-lucide-swords',
              color: 'primary',
              onSelect() {
                graveyard.addCard(props.stack.primary);
                battlefield.removeCardFromStack(props.stack.primary);
              },
            },
            {
              label: 'Exile',
              icon: 'i-lucide-ban',
              color: 'warning',
              onSelect() {
                //TODO
              },
            },
            {
              label: 'Delete',
              icon: 'i-lucide-trash',
              color: 'error',
              onSelect() {
                battlefield.removeCardFromStack(props.stack.primary);
              },
            },
          ]"
          :content="{
            align: 'start',
            side: 'bottom',
          }"
          size="xl"
        >
          <UButton
            icon="i-lucide-trash"
            color="error"
            size="xs"
            variant="soft"
            :disabled="battlefield.isAttaching"
          />
        </UDropdownMenu>
      </div>
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
import { useGraveyard } from '~/features/graveyard';
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

const settingsStore = useSettingsStore();
const { snapScale } = storeToRefs(settingsStore);

const battlefield = useBattlefield();

const graveyard = useGraveyard();

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
});
</script>

<style lang="scss" scoped>
.board-card-stack {
  width: auto;
  height: 100px;
}

.primary-card {
  position: relative;
  z-index: 1;
}

.attachments {
  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: column;
  margin-left: 24px;

  &.primary-tapped {
    margin-left: 60px;
  }

  > .board-card {
    top: calc(-128px * (var(--index) + 1));
    z-index: calc(var(--index) * -1);
    position: relative;
  }
}

.stack-actions {
  z-index: 1;

  &.tapped {
    margin-right: 35px;
    margin-top: 33px;
  }
}
</style>
