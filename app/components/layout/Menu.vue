<template>
  <UDropdownMenu
    :items="items"
    size="xl"
    :content="{
      align: 'start',
      side: 'bottom',
      sideOffset: 8,
    }"
  >
    <UButton
      icon="i-lucide-menu"
      variant="solid"
      color="info"
      size="xl"
      title="Open menu"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { useEventLogStore } from '~/features/eventLog';
import UButton from '@nuxt/ui/components/Button.vue';
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import { useFullscreen } from '@vueuse/core';
import { computed } from 'vue';
import type { DropdownMenuItem } from '@nuxt/ui';

const eventLog = useEventLogStore();
const fullscreen = useFullscreen();
// Rebuilt only when fullscreen toggles (its icon); nothing else in it changes,
// so it isn't a deep ref.
const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'MTG Harmony',
      icon: 'i-lucide-flame',
      color: 'primary',
      type: 'label',
    },
  ],
  [
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      color: 'primary',
      onSelect: () => emit('openSettingsRequested'),
    },
    {
      label: 'Event log',
      icon: 'i-lucide-scroll-text',
      color: 'neutral',
      onSelect: () => eventLog.openWindow(),
    },
    {
      label: 'Fullscreen',
      icon: fullscreen.isFullscreen.value
        ? 'i-lucide-shrink'
        : 'i-lucide-expand',
      color: 'neutral',
      onSelect: () => fullscreen.toggle(),
    },
  ],
  [
    {
      label: 'Clear board',
      icon: 'i-lucide-brush-cleaning',
      color: 'warning',
      onSelect: () => emit('clearBoardRequested'),
    },
    {
      label: 'New game',
      icon: 'i-lucide-flag',
      color: 'warning',
      onSelect: () => emit('newGameRequested'),
    },
    {
      label: 'Reset app',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect: () => emit('resetAllRequested'),
    },
  ],
  [
    {
      label: 'Feedback',
      icon: 'i-lucide-bug',
      color: 'neutral',
      to: 'https://github.com/cpsibo/mtg-harmony/issues',
      external: true,
      target: '_blank',
    },
  ],
]);

const emit = defineEmits<{
  openSettingsRequested: [];
  clearBoardRequested: [];
  newGameRequested: [];
  resetAllRequested: [];
}>();
</script>
