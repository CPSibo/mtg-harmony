<template>
  <!-- Phones have room only with tighter gaps, On-deck as an icon and the
       search button in the row rather than in the middle (#240). -->
  <div
    class="fixed left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] top-[calc(0.75rem+env(safe-area-inset-top))] flex gap-2 sm:gap-6 justify-end"
  >
    <DiscordFetch />

    <FloatingBar />

    <SelectionBar class="ms-auto" />

    <UndoButton />

    <LayoutTapButton />

    <LayoutMenu
      @open-settings-requested="emit('openSettingsRequested')"
      @open-about-requested="emit('openAboutRequested')"
      @clear-board-requested="emit('clearBoardRequested')"
      @new-game-requested="emit('newGameRequested')"
      @reset-all-requested="emit('resetAllRequested')"
    />
  </div>
</template>

<script setup lang="ts">
import LayoutMenu from '~/components/layout/Menu.vue';
import SelectionBar from '~/components/playArea/SelectionBar.vue';
import LayoutTapButton from '~/components/layout/TapButton.vue';
import UndoButton from '~/components/layout/UndoButton.vue';
import DiscordFetch from '../../features/discordFetcher/components/SidePanel.vue';
import { FloatingBar } from '~/features/palette';

const emit = defineEmits<{
  openSettingsRequested: [];
  openAboutRequested: [];
  clearBoardRequested: [];
  newGameRequested: [];
  resetAllRequested: [];
}>();
</script>
