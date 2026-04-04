<template>
  <div class="fixed left-3 right-3 top-3 z-10 flex gap-6 justify-end">
    <DiscordFetch />

    <div class="grow" />

    <LayoutTapButton />

    <LayoutMenu
      @open-settings-requested="emit('openSettingsRequested')"
      @clear-board-requested="emit('clearBoardRequested')"
      @clear-session-requested="emit('clearSessionRequested')"
      @reset-all-requested="emit('resetAllRequested')"
    />
  </div>
</template>

<script setup lang="ts">
import DiscordFetch from './DiscordFetch.vue';

const emit = defineEmits<{
  openSettingsRequested: [];
  clearBoardRequested: [];
  clearSessionRequested: [];
  resetAllRequested: [];
}>();
</script>
