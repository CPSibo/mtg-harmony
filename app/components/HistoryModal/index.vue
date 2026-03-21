<script setup lang="ts">
import { storeToRefs } from 'pinia'

defineProps<{
  open: boolean
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const historyStore = useHistoryStore()
const { entries } = storeToRefs(historyStore)
</script>

<template>
  <div>
    HistoryModal placeholder — {{ entries.length }} entries
  </div>
</template>
