<template>
  <UButton
    :variant="selection.mode ? 'solid' : 'subtle'"
    :color="selection.mode ? 'warning' : 'primary'"
    size="xl"
    icon="i-lucide-square-dashed-mouse-pointer"
    :class="{
      'ring-4 ring-warning/40 shadow-lg shadow-warning/30 sm:px-5':
        selection.mode,
    }"
    :title="title"
    :aria-label="label"
    :aria-pressed="selection.mode"
    @click="selection.setMode(!selection.mode)"
  >
    <!-- Hard to miss while on (#235): another colour, and a word. The count
         is here too, rather than a label beside it (#237). Phones keep the
         count only. -->
    <template v-if="selection.mode || selection.size">
      <span
        v-if="selection.mode"
        class="max-sm:hidden"
      >
        Selecting
      </span>
      <span v-if="selection.size">({{ selection.size }})</span>
    </template>
  </UButton>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { computed } from 'vue';
import { useSelectionStore } from '~/features/battlefield';
import { useInputModeStore } from '~/stores/inputMode';

const selection = useSelectionStore();
const inputMode = useInputModeStore();

/** What it does, and how many are selected. */
const label = computed(() => {
  const action = selection.mode ? 'Leave selection mode' : 'Select stacks';
  return selection.size ? `${action}, ${selection.size} selected` : action;
});

/** The label, and while on, how to select more: the bar's old hint. */
const title = computed(() => {
  if (!selection.mode) return label.value;
  const how = inputMode.isTouch
    ? 'Tap stacks or drag a box'
    : 'Click stacks or drag a box';
  return `${how}. ${label.value}`;
});
</script>
