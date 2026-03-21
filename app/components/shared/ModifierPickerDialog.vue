<script setup lang="ts">
import type { Modifier } from '~/types/card'

defineProps<{
  open: boolean
  cardName: string
}>()

defineEmits<{
  (e: 'select', modifier: Modifier): void
  (e: 'cancel'): void
  (e: 'update:open', value: boolean): void
}>()
</script>

<template>
  <div>ModifierPickerDialog placeholder — {{ cardName }}</div>
</template>
