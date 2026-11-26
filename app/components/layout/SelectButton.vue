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
    :aria-label="title"
    :aria-pressed="selection.mode"
    @click="selection.setMode(!selection.mode)"
  >
    <!-- Hard to miss while on (#235): another colour, and a word. -->
    <span
      v-if="selection.mode"
      class="max-sm:sr-only"
    >
      Selecting
    </span>
  </UButton>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { computed } from 'vue';
import { useSelectionStore } from '~/features/battlefield';

const selection = useSelectionStore();

const title = computed(() =>
  selection.mode ? 'Leave selection mode' : 'Select stacks',
);
</script>
