<template>
  <!-- In the top row (#237). Off with nothing selected, it's only the
       selection mode button; on, or with a selection, the bar grows from it.
       Where the row has no room for it (below 1400px, with the search button
       in the middle), it opens as a tray under the row instead. -->
  <div
    class="selection-bar flex items-center rounded-md"
    :class="{
      'min-[1400px]:bg-elevated/90 min-[1400px]:ring min-[1400px]:ring-default min-[1400px]:shadow-lg min-[1400px]:pe-1':
        shown,
    }"
    :role="shown ? 'status' : undefined"
  >
    <LayoutSelectButton />
    <Transition name="selection-bar">
      <div
        v-if="shown"
        class="selection-bar-actions flex items-center gap-1 absolute end-0 top-full mt-3 rounded-md bg-elevated/90 ring ring-default shadow-lg p-1 ps-3 min-[1400px]:static min-[1400px]:mt-0 min-[1400px]:bg-transparent min-[1400px]:ring-0 min-[1400px]:shadow-none min-[1400px]:p-0 min-[1400px]:ps-3"
      >
        <span class="text-sm whitespace-nowrap max-sm:sr-only">
          {{ label }}
        </span>
        <template
          v-for="cmd in buttons"
          :key="cmd.id"
        >
          <!-- A command with choices (Copy's modes) opens them as a menu. -->
          <UDropdownMenu
            v-if="cmd.choices"
            :items="choiceItems(cmd)"
            :content="{ side: 'bottom' }"
          >
            <UButton
              :icon="cmd.icon"
              color="neutral"
              variant="ghost"
              size="xl"
              :title="commandLabel(cmd)"
              :aria-label="commandLabel(cmd)"
            />
          </UDropdownMenu>
          <UButton
            v-else
            :icon="cmd.icon"
            color="neutral"
            variant="ghost"
            size="xl"
            :title="commandLabel(cmd)"
            :aria-label="commandLabel(cmd)"
            @click="registry.run(cmd)"
          />
        </template>
        <UDropdownMenu
          v-if="menu.length"
          :items="menu"
          :content="{ side: 'bottom' }"
        >
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="ghost"
            size="xl"
            title="More"
            aria-label="More"
          />
        </UDropdownMenu>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xl"
          title="Clear selection (Esc)"
          aria-label="Clear selection"
          @click="clear"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import { computed } from 'vue';
import LayoutSelectButton from '~/components/layout/SelectButton.vue';
import { useSelectionStore } from '~/features/battlefield';
import {
  commandLabel,
  useWidgetRegistry,
  type WidgetCommand,
} from '~/features/widgets';
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
const choiceItems = (cmd: WidgetCommand) =>
  (cmd.choices ?? []).map((c) => ({
    label: c.label,
    icon: c.icon,
    onSelect: () => registry.run(cmd, c),
  }));
const menu = computed(() =>
  registry.selectionCommands
    .filter((c) => c.bar === 'menu')
    .map((c) =>
      c.choices
        ? { label: commandLabel(c), icon: c.icon, children: choiceItems(c) }
        : {
            label: commandLabel(c),
            icon: c.icon,
            onSelect: () => registry.run(c),
          },
    ),
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
  translate: 0 -0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .selection-bar-enter-active,
  .selection-bar-leave-active {
    transition: none;
  }
}
</style>
