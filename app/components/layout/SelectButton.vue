<template>
  <UButton
    :variant="selection.mode ? 'solid' : 'subtle'"
    color="primary"
    size="xl"
    icon="i-lucide-square-dashed-mouse-pointer"
    :title="title"
    :aria-label="title"
    :aria-pressed="selection.mode"
    @click="selection.setMode(!selection.mode)"
  />
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
