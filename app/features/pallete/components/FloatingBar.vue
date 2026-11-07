<template>
  <UModal
    v-model:open="open"
    :modal="false"
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
      class="fixed top-2 left-1/2 -translate-x-1/2"
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
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue';
import UKbd from '@nuxt/ui/components/Kbd.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { defineShortcuts } from '@nuxt/ui/composables';
import { computed, ref } from 'vue';
import { useWidgetRegistry } from '~/features/widgets';

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
