<template>
  <UButton
    v-if="graveyardStore.graveyardWindowButtonIsVisible"
    class="fixed bottom-3 right-3 min-w-0 p-2 bg-taupe-700 text-gray-100 active:bg-taupe-500 hover:bg-taupe-500"
    @click="graveyardStore.toggleGraveyardWindow"
  >
    <UIcon
      name="i-lucide-skull"
      :size="40"
    />
  </UButton>
</template>

<script setup lang="ts">
import { useGraveyard } from '..';

const graveyardStore = useGraveyard();
</script>
