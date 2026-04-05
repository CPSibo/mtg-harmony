<template>
  <LayoutGlobalButtons
    @open-settings-requested="openSettings"
    @clear-board-requested="showConfirmClearBoard = true"
    @clear-session-requested="showConfirmClearSession = true"
    @reset-all-requested="showConfirmResetAppData = true"
  />
  
  <div class="h-full w-full">
    <PlayAreaBoard />
  </div>

  <Graveyard />

  <LazySharedClearBoardModal v-model:open="showConfirmClearBoard" />
  <LazySharedClearSessionModal v-model:open="showConfirmClearSession" />
  <LazySharedResetAppDataModal v-model:open="showConfirmResetAppData" />
</template>

<script setup lang="ts">
import Graveyard from '~/components/widgets/Graveyard.vue';
import { LazySettingsModal } from '#components';

const toast = useToast();
const overlay = useOverlay();

const settingsStore = useSettingsStore();
const battlefield = useBattlefield();
const onDeckStore = useOnDeckStore();
const graveyard = useGraveyard();

onMounted(() => {
  const results = [
    settingsStore.load(),
    battlefield.load(),
    onDeckStore.load(),
    graveyard.load(),
  ];

  if (results.some((r) => r === true)) {
    toast.add({
      title: 'Restored session',
      color: 'success',
    });
  }
});

const settingsModal = overlay.create(LazySettingsModal);

async function openSettings() {
  settingsModal.open();
}

const showConfirmClearBoard = ref(false);
const showConfirmClearSession = ref(false);
const showConfirmResetAppData = ref(false);
</script>
