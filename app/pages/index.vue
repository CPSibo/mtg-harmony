<script setup lang="ts">
const historyOpen = ref(false)
</script>

<template>
  <div class="flex h-dvh flex-col">
    <HamburgerMenu />
    <OnDeckSlot />
    <CardGrid class="min-h-0 flex-1" />
    <HistoryModal v-model:open="historyOpen" />
  </div>
</template>
