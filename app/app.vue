<template>
  <UApp>
    <LayoutGlobalButtons
      @open-settings-requested="openSettings"
      @clear-board-requested="showConfirmClearBoard = true"
      @clear-session-requested="showConfirmClearSession = true"
      @reset-all-requested="showConfirmResetAppData = true"
    />

    <UMain class="w-svw h-svh min-h-0">
      <NuxtPage />
    </UMain>

    <LazySharedClearBoardModal v-model:open="showConfirmClearBoard" />
    <LazySharedClearSessionModal v-model:open="showConfirmClearSession" />
    <LazySharedResetAppDataModal v-model:open="showConfirmResetAppData" />
  </UApp>
</template>

<script setup lang="ts">
import { LazySettingsModal } from '#components';

const toast = useToast();
const overlay = useOverlay();

/* Layout */

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en',
  },
});

const title = 'MTG Harmony';
const description =
  'Pull random cards and display them in a grid when playing "Discord, Lord of Disharmony".';

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterCard: 'summary_large_image',
});

const settingsStore = useSettingsStore();
const battlefield = useBattlefield();
const onDeckStore = useOnDeckStore();

onMounted(() => {
  const results = [
    settingsStore.load(),
    battlefield.load(),
    onDeckStore.load(),
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
  const instance = settingsModal.open();
}

const showConfirmClearBoard = ref(false);
const showConfirmClearSession = ref(false);
const showConfirmResetAppData = ref(false);
</script>
