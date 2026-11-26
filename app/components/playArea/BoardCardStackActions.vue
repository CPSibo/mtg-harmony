<template>
  <div
    class="stack-actions flex-col gap-4 flex"
    :class="{ 'is-touch': isTouch, 'is-menu-open': copyMenuOpen }"
    @click.capture="selection.setMode(false)"
  >
    <UButton
      :ui="{ base: 'bg-primary/80 text-black' }"
      size="xs"
      variant="solid"
      :disabled="battlefield.isAttaching"
      :aria-label="stack.primary.tapped ? 'Untap' : 'Tap'"
      :title="stack.primary.tapped ? 'Untap' : 'Tap'"
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
      aria-label="Card details"
      title="Card details"
      :ui="{ base: 'bg-slate-300/85 text-black' }"
      size="xs"
      variant="solid"
      :disabled="battlefield.isAttaching"
      @click="emits('showCardDetails', stack.primary)"
    />

    <UDropdownMenu
      v-model:open="copyMenuOpen"
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
        title="Copy"
        :ui="{ base: 'bg-slate-300/85 text-black' }"
        size="xs"
        variant="solid"
        :disabled="battlefield.isAttaching"
      />
    </UDropdownMenu>

    <UButton
      icon="i-lucide-trash"
      aria-label="Remove card"
      title="Remove card"
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
import { useBattlefieldStore, useSelectionStore } from '~/features/battlefield';
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
// A stack's own buttons are outside selection mode (#235).
const selection = useSelectionStore();
const copyCard = useCopyAnimation();

const showConfirmRemove = ref(false);
// The menu renders in a portal, so opening it ends the stack's hover. Without this the
// buttons hide, the menu's anchor collapses to 0×0 and the menu jumps to the top-left.
const copyMenuOpen = ref(false);
</script>

<style lang="scss" scoped>
.stack-actions {
  width: var(--actions-total-width);
  padding-right: var(--actions-padding-right);
  z-index: 1;
  position: relative;

  /* Hidden but still in the tab order, so Tab can reach a card's actions
     (#170). The container keeps its pointer events, so hovering where the
     actions sit shows them. */
  &:not(.is-touch):not(.is-menu-open) > * {
    opacity: 0;
    pointer-events: none;
  }
}

/* Keyboard focus on the card or its actions shows them too; a click doesn't,
   so they don't stay up after the mouse leaves. */
.board-card-stack:hover,
.board-card-stack:has(:focus-visible) {
  .stack-actions > * {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
