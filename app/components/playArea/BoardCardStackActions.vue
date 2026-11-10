<template>
  <div
    class="stack-actions flex-col gap-4 flex"
    :class="{ 'is-touch': isTouch }"
  >
    <UButton
      :ui="{ base: 'bg-primary/80 text-black' }"
      size="xs"
      variant="solid"
      :disabled="battlefield.isAttaching"
      @click="battlefield.toggleTapped(stack.primary)"
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
          onSelect: () => copyCard(stack.primary, 'card'),
          color: 'primary',
        },
        {
          label: 'Copy card + counters',
          icon: 'i-lucide-copy-plus',
          onSelect: () => copyCard(stack.primary, 'counters'),
        },
        {
          label: 'Copy everything',
          icon: 'i-lucide-square-stack',
          onSelect: () => copyCard(stack.primary, 'stack'),
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
        aria-label="Copy"
        :ui="{ base: 'bg-slate-300/85 text-black' }"
        size="xs"
        variant="solid"
        :disabled="battlefield.isAttaching"
      />
    </UDropdownMenu>

    <UButton
      icon="i-lucide-trash"
      aria-label="Remove card"
      :ui="{ base: 'bg-error/80 text-black' }"
      size="xs"
      variant="solid"
      :disabled="battlefield.isAttaching"
      @click="showConfirmRemove = true"
    />

    <PlayAreaRemoveCardModal
      v-model="showConfirmRemove"
      :card="props.stack.primary"
    />
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import PlayAreaRemoveCardModal from '~/components/playArea/RemoveCardModal.vue';
import { useInputModeStore } from '~/stores/inputMode';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useCopyAnimation } from '~/features/castAnimation';
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
const copyCard = useCopyAnimation();

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
}

.board-card-stack:hover {
  .stack-actions {
    * {
      display: block;
    }
  }
}
</style>
