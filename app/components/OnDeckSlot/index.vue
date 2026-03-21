<script setup lang="ts">
import { storeToRefs } from 'pinia'

const { onDeckExpanded } = storeToRefs(useSettingsStore())
</script>

<template>
  <OnDeckSlotExpanded v-if="onDeckExpanded" />
  <OnDeckSlotShrunk v-else />
</template>
