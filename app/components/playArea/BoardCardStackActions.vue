<template>
  <div
    class="stack-actions flex-col gap-4 flex"
    :class="{ tapped: stack.primary.tapped, 'is-touch': isTouch }"
  >
    <UButton
      :ui="{ base: 'bg-primary/80 text-black' }"
      size="xs"
      variant="solid"
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
      :ui="{ base: 'bg-slate-300/85 text-black' }"
      size="xs"
      variant="solid"
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
        :ui="{ base: 'bg-slate-300/85 text-black' }"
        size="xs"
        variant="solid"
        :disabled="battlefield.isAttaching"
      />
    </UDropdownMenu>

    <UButton
      icon="i-lucide-trash"
      :ui="{ base: 'bg-error/80 text-black' }"
      size="xs"
      variant="solid"
      :disabled="battlefield.isAttaching"
      @click="showConfirmRemove = true"
    />

    <PlayAreaRemoveCardModal
      v-model.sync="showConfirmRemove"
      :card="props.stack.primary"
    />
  </div>
</template>

<script setup lang="ts">
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

const props = defineProps<{
  stack: BoardCardStack;
}>();

const emits = defineEmits<{
  showCardDetails: [BoardCard];
}>();

const inputModeStore = useInputModeStore();
const { isTouch } = storeToRefs(inputModeStore);

const battlefield = useBattlefieldStore();

const showConfirmRemove = ref(false);
</script>

<style lang="scss" scoped>
.stack-actions {
  width: var(--actions-total-width);
  padding-right: var(--actions-padding-right);
  z-index: 1;
  position: relative;

  &:not(.is-touch) * {
    display: none;
  }

  &.tapped {
    // margin-right: 35px;
    // margin-top: 33px;
  }
}

.board-card-stack:hover {
  .stack-actions {
    * {
      display: block;
    }

    &.tapped {
      // right: 35px;
    }
  }
}
</style>
