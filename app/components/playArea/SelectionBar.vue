<template>
  <Transition name="selection-bar">
    <div
      v-if="selection.mode || selection.size"
      class="selection-bar fixed left-1/2 -translate-x-1/2 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 rounded-full bg-elevated/90 ring ring-default shadow-lg ps-4 pe-1 py-1"
      role="status"
    >
      <UIcon
        name="i-lucide-square-dashed-mouse-pointer"
        class="size-4 text-primary"
      />
      <span class="text-sm whitespace-nowrap">{{ label }}</span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        class="rounded-full"
        title="Clear selection (Esc)"
        aria-label="Clear selection"
        @click="clear"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import { computed } from 'vue';
import { useSelectionStore } from '~/features/battlefield';
import { useInputModeStore } from '~/stores/inputMode';

const selection = useSelectionStore();
const inputMode = useInputModeStore();

const label = computed(() => {
  const n = selection.size;
  if (n) return `${n} selected`;
  return inputMode.isTouch
    ? 'Tap stacks or drag a box'
    : 'Click stacks or drag a box';
});

/** Clears the selection and leaves selection mode. */
function clear() {
  selection.clear();
  selection.setMode(false);
}
</script>

<style scoped>
.selection-bar-enter-active,
.selection-bar-leave-active {
  transition:
    opacity 150ms ease-out,
    translate 150ms ease-out;
}

.selection-bar-enter-from,
.selection-bar-leave-to {
  opacity: 0;
  translate: 0 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .selection-bar-enter-active,
  .selection-bar-leave-active {
    transition: none;
  }
}
</style>
