<script setup lang="ts">
import { storeToRefs } from 'pinia'

const gridStore = useGridStore()
const { pageCards } = storeToRefs(gridStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotsPerPage } = storeToRefs(settingsStore)

const emptySlots = computed(() =>
  Math.max(0, slotsPerPage.value - pageCards.value.length)
)

const gridEl = ref<HTMLElement | null>(null)

useSwipe(gridEl, {
  threshold: 50,
  onSwipeEnd(_e, direction) {
    if (direction === 'left') gridStore.nextPage()
    else if (direction === 'right') gridStore.prevPage()
  },
})
</script>

<template>
  <div ref="gridEl" class="flex flex-col gap-2 select-none touch-pan-y overflow-hidden">
    <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))">
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
    </div>
    <CardGridGridPaginator />
  </div>
</template>
