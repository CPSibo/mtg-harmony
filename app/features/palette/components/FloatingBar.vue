<template>
  <UModal
    v-model:open="open"
    :modal="false"
    :content="{
      // Closing after a command mustn't send focus back to the search
      // button: the window the command opened would see focus leave and close.
      onCloseAutoFocus: (e: Event) => e.preventDefault(),
    }"
    :ui="{
      content: 'top-2 translate-none -translate-x-1/2!',
    }"
    @update:open="
      () => {
        searchTerm = '';
      }
    "
  >
    <UButton
      icon="i-lucide-search"
      class="fixed top-[calc(0.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2"
      color="neutral"
      variant="subtle"
      @click="
        () => {
          open = true;
        }
      "
    >
      <template #trailing>
        <UKbd value="/" />
      </template>
    </UButton>

    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        @update:model-value="open = false"
      />
      <!-- A picked command runs and the palette gets out of its way, so a
           window it opens (like Add Card) isn't left stacked under it. -->
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UKbd from '@nuxt/ui/components/Kbd.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { defineShortcuts } from '@nuxt/ui/composables';
import { computed, defineAsyncComponent, ref } from 'vue';
import { useWidgetRegistry } from '~/features/widgets';

// The palette (with fuse.js and a virtualizer) loads when the browser is
// idle or on first open, so it stays out of the startup bundle.
const loadPalette = () => import('@nuxt/ui/components/CommandPalette.vue');
const UCommandPalette = defineAsyncComponent(loadPalette);
window.requestIdleCallback?.(() => void loadPalette());

const open = defineModel<boolean>('open');

defineShortcuts({
  '/': () => {
    open.value = true;
  },
});

const registry = useWidgetRegistry();
const groups = computed(() => registry.paletteGroups);

const searchTerm = ref('');
</script>
