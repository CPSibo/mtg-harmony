<script setup lang="ts">
import { storeToRefs } from 'pinia'

const { onDeckExpanded } = storeToRefs(useSettingsStore())
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-[opacity,transform] duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
    mode="out-in"
  >
    <OnDeckSlotExpanded v-if="onDeckExpanded" key="expanded" />
    <OnDeckSlotShrunk v-else key="shrunk" />
  </Transition>
</template>
