<script setup lang="ts">
import { storeToRefs } from 'pinia'

const settingsStore = useSettingsStore()
const { slotsPerPage, gridDisplayMode } = storeToRefs(settingsStore)

const gridStore = useGridStore()

const historyOpen = ref(false)
const confirmClearOpen = ref(false)
const confirmResetOpen = ref(false)
</script>

<template>
  <div>
    HamburgerMenu placeholder — slotsPerPage: {{ slotsPerPage }}, mode: {{ gridDisplayMode }}
  </div>
</template>
