<script setup lang="ts">
import { storeToRefs } from 'pinia'

const gridStore = useGridStore()
const { pageCards } = storeToRefs(gridStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotsPerPage } = storeToRefs(settingsStore)

const emptySlots = computed(() =>
  Math.max(0, slotsPerPage.value - pageCards.value.length)
)
</script>

<template>
  <div>
    <CardGridGridSlot
      v-for="card in pageCards"
      :key="card.id"
      :card="card"
      :display-mode="gridDisplayMode"
    />
    <CardGridGridSlot
      v-for="i in emptySlots"
      :key="`empty-${i}`"
      :card="null"
      :display-mode="gridDisplayMode"
    />
    <CardGridGridPaginator />
  </div>
</template>
