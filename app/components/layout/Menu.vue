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
      @click="isMenuOpen = true"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { useEventLogStore } from '~/features/eventLog';
import UButton from '@nuxt/ui/components/Button.vue';
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import { useFullscreen } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { DropdownMenuItem } from '@nuxt/ui';

const isMenuOpen = ref(false);

const eventLog = useEventLogStore();
const fullscreen = useFullscreen();
const fullscreenIcon = computed(() =>
  fullscreen.isFullscreen.value ? 'i-lucide-shrink' : 'i-lucide-expand',
);
const items = ref<DropdownMenuItem[][]>([
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
      icon: fullscreenIcon,
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
      label: 'Clear session',
      icon: 'i-lucide-rotate-ccw',
      color: 'warning',
      onSelect: () => emit('clearSessionRequested'),
    },
    {
      label: 'Reset all data',
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
  clearSessionRequested: [];
  resetAllRequested: [];
}>();
</script>
