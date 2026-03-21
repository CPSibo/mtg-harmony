<script setup lang="ts">
const historyOpen = ref(false)
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <HamburgerMenu />
    <OnDeckSlot />
    <CardGrid />
    <HistoryModal v-model:open="historyOpen" />
  </div>
</template>
