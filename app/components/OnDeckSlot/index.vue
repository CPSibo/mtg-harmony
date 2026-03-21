<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()
const { onDeckExpanded } = storeToRefs(settingsStore)

const { loading, error, fetch } = useScryfall()
</script>

<template>
  <div>
    OnDeckSlot placeholder — card: {{ card?.name ?? 'none' }}, expanded: {{ onDeckExpanded }}
  </div>
</template>
