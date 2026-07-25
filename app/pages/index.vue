<template>
  <div class="h-full w-full">
    <PlayAreaBoard />
  </div>

  <LayoutGlobalButtons
    @open-settings-requested="openSettings"
    @clear-board-requested="showConfirmClearBoard = true"
    @clear-session-requested="showConfirmClearSession = true"
    @reset-all-requested="showConfirmResetAppData = true"
  />

  <LazySharedClearBoardModal v-model:open="showConfirmClearBoard" />
  <LazySharedClearSessionModal v-model:open="showConfirmClearSession" />
  <LazySharedResetAppDataModal v-model:open="showConfirmResetAppData" />

  <AddCardWidgetComponent />
  <AddCardWindow />

  <!-- <GraveyardWidgetComponent />
  <GraveyardWindow />
  <GraveyardButton v-model:open="showGraveyard" /> -->

  <FloatingBar @graveyard_toggle-window="showGraveyard = true" />
</template>

<script setup lang="ts">
import {
  GraveyardButton,
  GraveyardWidgetComponent,
  GraveyardWindow,
} from '~/features/graveyard';
import { LazySettingsModal } from '#components';
import { AddCardWidgetComponent, AddCardWindow } from '~/features/addCard';
import { FloatingBar } from '~/features/pallete';

const overlay = useOverlay();

const settingsModal = overlay.create(LazySettingsModal);

async function openSettings() {
  settingsModal.open();
}

const showConfirmClearBoard = ref(false);
const showConfirmClearSession = ref(false);
const showConfirmResetAppData = ref(false);

const showGraveyard = ref(false);

// Load the store globally, so the values get set.
const inputModeStore = useInputModeStore()
</script>
