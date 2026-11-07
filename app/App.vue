<template>
  <UApp>
    <UMain class="w-svw h-svh min-h-0">
      <div class="h-full w-full">
        <PlayAreaBoard />
      </div>

      <GlobalButtons
        @open-settings-requested="openSettings"
        @clear-board-requested="showConfirmClearBoard = true"
        @clear-session-requested="showConfirmClearSession = true"
        @reset-all-requested="showConfirmResetAppData = true"
      />

      <ClearBoardModal v-model:open="showConfirmClearBoard" />
      <ClearSessionModal v-model:open="showConfirmClearSession" />
      <ResetAppDataModal v-model:open="showConfirmResetAppData" />

      <AddCardWidgetComponent />
      <AddCardWindow />

      <FloatingBar />
    </UMain>
  </UApp>
</template>

<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import UMain from '@nuxt/ui/components/Main.vue';
import { useOverlay } from '@nuxt/ui/composables';
import { defineAsyncComponent, onMounted, ref } from 'vue';
import GlobalButtons from '~/components/layout/GlobalButtons.vue';
import PlayAreaBoard from '~/components/playArea/Board.vue';
import { removeRetiredStorage } from '~/composables/useLocalStorage';
import { AddCardWidgetComponent, AddCardWindow } from '~/features/addCard';
import { FloatingBar } from '~/features/pallete';
import { useInputModeStore } from '~/stores/inputMode';

const ClearBoardModal = defineAsyncComponent(
  () => import('~/components/shared/ClearBoardModal.vue'),
);
const ClearSessionModal = defineAsyncComponent(
  () => import('~/components/shared/ClearSessionModal.vue'),
);
const ResetAppDataModal = defineAsyncComponent(
  () => import('~/components/shared/ResetAppDataModal.vue'),
);
const SettingsModal = defineAsyncComponent(
  () => import('~/components/settings/SettingsModal.vue'),
);

onMounted(removeRetiredStorage);

const overlay = useOverlay();
const settingsModal = overlay.create(SettingsModal);

function openSettings() {
  settingsModal.open();
}

const showConfirmClearBoard = ref(false);
const showConfirmClearSession = ref(false);
const showConfirmResetAppData = ref(false);

// Load the store globally, so the values get set.
useInputModeStore();
</script>
