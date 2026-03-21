<script setup lang="ts">
import type { GridCard } from '~/types/card'

const props = defineProps<{
  card: GridCard | null
  displayMode: 'full' | 'compact'
}>()

defineEmits<{
  (e: 'contextMenu', cardId: string, event: MouseEvent): void
}>()
</script>

<template>
  <div>
    GridSlot placeholder — {{ props.card?.name ?? 'empty' }} ({{ props.displayMode }})
  </div>
</template>
