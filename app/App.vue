<template>
  <UApp>
    <UMain class="w-svw h-svh min-h-0">
      <div class="h-full w-full">
        <PlayAreaBoard />
      </div>

      <GlobalButtons
        @open-settings-requested="openSettings"
        @open-about-requested="aboutModal.open()"
        @clear-board-requested="showConfirmClearBoard = true"
        @new-game-requested="showConfirmNewGame = true"
        @reset-all-requested="showConfirmResetAppData = true"
      />

      <ClearBoardModal v-model:open="showConfirmClearBoard" />
      <NewGameModal v-model:open="showConfirmNewGame" />
      <ResetAppDataModal v-model:open="showConfirmResetAppData" />

      <AddCardWidgetComponent />
      <!-- Loaded the first time they open, then kept for their close animation. -->
      <AddCardWindow v-if="addCardLoaded" />

      <EventLogWidgetComponent />
      <EventLogWindow v-if="eventLogLoaded" />
      <NewGamePrompt />

      <FloatingBar />
    </UMain>
  </UApp>
</template>

<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import UMain from '@nuxt/ui/components/Main.vue';
import { useOverlay, useToast } from '@nuxt/ui/composables';
import { useEventListener, useFullscreen } from '@vueuse/core';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import GlobalButtons from '~/components/layout/GlobalButtons.vue';
import PlayAreaBoard from '~/components/playArea/Board.vue';
import {
  flushSaves,
  onSaveError,
  removeRetiredStorage,
} from '~/composables/useLocalStorage';
import { useKeepScreenAwake } from '~/composables/useKeepScreenAwake';
import { AddCardWidgetComponent, useAddCard } from '~/features/addCard';
import {
  EventLogWidgetComponent,
  NewGamePrompt,
  useEventLogStore,
} from '~/features/eventLog';
import { FloatingBar } from '~/features/palette';
import { useBattlefieldStore } from '~/features/battlefield';
import { useWidget } from '~/features/widgets';
import { useInputModeStore } from '~/stores/inputMode';
import { useUpdateCheck } from '~/pwa/updateCheck';

// The Add Card and event log windows (with export and the archive) load the
// first time they open, so they stay out of the startup bundle (#102).
const AddCardWindow = defineAsyncComponent(
  () => import('~/features/addCard/components/AddCardWindow.vue'),
);
const EventLogWindow = defineAsyncComponent(
  () => import('~/features/eventLog/components/EventLogWindow.vue'),
);
const addCard = useAddCard();
const log = useEventLogStore();
const battlefield = useBattlefieldStore();
// True from the first open on (a computed gets its previous value).
const addCardLoaded = computed(
  (was: boolean | undefined) => !!was || addCard.addCardWindowIsOpen,
);
const eventLogLoaded = computed(
  (was: boolean | undefined) => !!was || log.windowIsOpen,
);

const ClearBoardModal = defineAsyncComponent(
  () => import('~/components/shared/ClearBoardModal.vue'),
);
const NewGameModal = defineAsyncComponent(
  () => import('~/components/shared/NewGameModal.vue'),
);
const ResetAppDataModal = defineAsyncComponent(
  () => import('~/components/shared/ResetAppDataModal.vue'),
);
const AboutModal = defineAsyncComponent(
  () => import('~/components/about/AboutModal.vue'),
);
const SettingsModal = defineAsyncComponent(
  () => import('~/components/settings/SettingsModal.vue'),
);

onMounted(removeRetiredStorage);

// Saves are debounced, so write the last change before the page goes away.
// Mobile browsers may kill a hidden tab without firing pagehide.
useEventListener(window, 'pagehide', flushSaves);
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSaves();
});

const toast = useToast();
onSaveError(() =>
  toast.add({
    title: 'Could not save',
    description:
      'Your browser storage is full or blocked. Changes may be lost on reload.',
    color: 'error',
    icon: 'i-lucide-triangle-alert',
  }),
);

const overlay = useOverlay();
const settingsModal = overlay.create(SettingsModal);
const aboutModal = overlay.create(AboutModal);

function openSettings() {
  settingsModal.open();
}

const showConfirmClearBoard = ref(false);
const showConfirmNewGame = ref(false);
const showConfirmResetAppData = ref(false);

const fullscreen = useFullscreen();

// The menu's actions in the palette too (#218).
useWidget({
  id: 'app',
  label: 'App',
  icon: 'i-lucide-flame',
  order: 80,
  hideWithSelection: true,
  commands: [
    {
      id: 'app.clearBoard',
      label: 'Clear board',
      icon: 'i-lucide-brush-cleaning',
      enabled: () => battlefield.stacks.length > 0,
      execute: () => (showConfirmClearBoard.value = true),
    },
    {
      id: 'app.newGame',
      label: 'New game',
      icon: 'i-lucide-flag',
      execute: () => (showConfirmNewGame.value = true),
    },
    {
      id: 'app.settings',
      label: 'Settings',
      icon: 'i-lucide-settings',
      execute: openSettings,
    },
    {
      id: 'app.fullscreen',
      label: 'Turn fullscreen on or off',
      icon: 'i-lucide-expand',
      toast: () => `Fullscreen ${fullscreen.isFullscreen.value ? 'off' : 'on'}`,
      execute: () => void fullscreen.toggle(),
    },
    {
      id: 'app.about',
      label: 'About',
      icon: 'i-lucide-info',
      execute: () => aboutModal.open(),
    },
  ],
});

// Load the store globally, so the values get set.
useInputModeStore();

useKeepScreenAwake();
useUpdateCheck();
</script>
