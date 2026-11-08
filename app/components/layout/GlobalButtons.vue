<template>
  <div
    class="fixed left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] top-[calc(0.75rem+env(safe-area-inset-top))] flex gap-6 justify-end"
  >
    <DiscordFetch />

    <div class="grow" />

    <LayoutTapButton />

    <LayoutMenu
      @open-settings-requested="emit('openSettingsRequested')"
      @clear-board-requested="emit('clearBoardRequested')"
      @new-game-requested="emit('newGameRequested')"
      @reset-all-requested="emit('resetAllRequested')"
    />
  </div>
</template>

<script setup lang="ts">
import LayoutMenu from '~/components/layout/Menu.vue';
import LayoutTapButton from '~/components/layout/TapButton.vue';
import DiscordFetch from '../../features/discordFetcher/components/SidePanel.vue';

const emit = defineEmits<{
  openSettingsRequested: [];
  clearBoardRequested: [];
  newGameRequested: [];
  resetAllRequested: [];
}>();
</script>
