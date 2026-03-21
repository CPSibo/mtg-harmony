<script setup lang="ts">
import { storeToRefs } from 'pinia'

const gridStore = useGridStore()
const { currentPage, totalPages } = storeToRefs(gridStore)

const isAtStart = computed(() => currentPage.value === 0)
const isAtEnd = computed(() => currentPage.value >= totalPages.value - 1)
const showPaginator = computed(() => totalPages.value > 1)
</script>

<template>
  <div v-if="showPaginator" class="flex items-center gap-1">
    <UButton
      icon="i-lucide-chevron-left"
      variant="ghost"
      :disabled="isAtStart"
      aria-label="Previous page"
      title="Previous page"
      @click="gridStore.prevPage()"
    />
    <UButton
      icon="i-lucide-chevron-right"
      variant="ghost"
      :disabled="isAtEnd"
      aria-label="Next page"
      title="Next page"
      @click="gridStore.nextPage()"
    />
  </div>
</template>
