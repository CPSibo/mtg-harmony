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


  <WidgetsAddCard v-model:open="addCardsIsOpen" />

  <Graveyard v-model:open="showGraveyard" />

  <LazyWidgetsPallete
    @open_add-cards_to-battlefield="addCardsIsOpen = true"
    @graveyard_toggle-window="showGraveyard = true"
  />
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

const addCardsIsOpen = ref(false);
const showGraveyard = ref(false);
</script>
