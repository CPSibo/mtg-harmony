<template>
  <UButton
    variant="solid"
    color="primary"
    size="xl"
    title="Untap all"
    @click="battlefield.untapAll"
  >
    <span class="ms ms-untap ms-2x" />
  </UButton>
</template>

<script setup lang="ts">
import { useBattlefieldStore } from '~/features/battlefield';

const battlefield = useBattlefieldStore();
</script>
