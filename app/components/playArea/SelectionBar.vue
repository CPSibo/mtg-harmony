<template>
  <Transition name="selection-bar">
    <div
      v-if="shown"
      class="selection-bar fixed left-1/2 -translate-x-1/2 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 rounded-full bg-elevated/90 ring ring-default shadow-lg ps-4 pe-1 py-1"
      role="status"
    >
      <UIcon
        name="i-lucide-square-dashed-mouse-pointer"
        class="size-4 text-primary"
      />
      <span class="text-sm whitespace-nowrap">{{ label }}</span>
      <UButton
        v-for="cmd in buttons"
        :key="cmd.id"
        :icon="cmd.icon"
        color="neutral"
        variant="ghost"
        size="sm"
        class="rounded-full"
        :title="cmd.label"
        :aria-label="cmd.label"
        @click="cmd.execute()"
      />
      <UDropdownMenu
        v-if="menu.length"
        :items="menu"
        :content="{ side: 'top' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-full"
          title="More"
          aria-label="More"
        />
      </UDropdownMenu>
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
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import { computed } from 'vue';
import { useSelectionStore } from '~/features/battlefield';
import { useWidgetRegistry } from '~/features/widgets';
import { useInputModeStore } from '~/stores/inputMode';

const selection = useSelectionStore();
const inputMode = useInputModeStore();

const registry = useWidgetRegistry();

/**
 * Hidden for a lone selected stack outside selection mode (#216): a plain
 * tap selects one, and that's used through the palette and shortcuts, not
 * a bar popping up at every tap.
 */
const shown = computed(() => selection.mode || selection.size > 1);

// Selection commands that apply now, as the bar shows them.
const buttons = computed(() =>
  registry.selectionCommands.filter((c) => c.bar === 'button'),
);
const menu = computed(() =>
  registry.selectionCommands
    .filter((c) => c.bar === 'menu')
    .map((c) => ({ label: c.label, icon: c.icon, onSelect: c.execute })),
);

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
