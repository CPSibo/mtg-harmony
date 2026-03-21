<script setup lang="ts">
import { storeToRefs } from 'pinia'

const gridStore = useGridStore()
const { currentPage, totalPages } = storeToRefs(gridStore)
</script>

<template>
  <div>
    GridPaginator placeholder — page {{ currentPage + 1 }} of {{ totalPages }}
  </div>
</template>
