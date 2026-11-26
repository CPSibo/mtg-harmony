<template>
  <UButton
    variant="solid"
    color="neutral"
    size="xl"
    icon="i-lucide-undo-2"
    title="Undo"
    aria-label="Undo"
    :disabled="!battlefield.canUndo"
    @click="battlefield.undo()"
  />
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { useBattlefieldStore } from '~/features/battlefield';

/**
 * Takes back the last structural change (#215): on touch there's no Ctrl+Z,
 * and a toast's Undo is gone after a few seconds.
 */
const battlefield = useBattlefieldStore();
</script>
