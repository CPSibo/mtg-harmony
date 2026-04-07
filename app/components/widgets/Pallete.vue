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
      <LazyUCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { CommandPaletteGroup } from '@nuxt/ui';

const emit = defineEmits<{
  open_addCards_toBattlefield: [],
  graveyard_toggleWindow: [],
}>()

const open = defineModel<boolean>('open');

defineShortcuts({
  '/': () => {
    open.value = true;
  },
});

const groups = ref<CommandPaletteGroup[]>([
  {
    id: 'Battlefield',
    label: 'Battlefield',
    items: [
      {
        label: 'Add card to battlefield',
        icon: 'i-lucide-square-plus',
        kbds: ['b-a'],
        onSelect: () => {emit('open_addCards_toBattlefield')},
      },
      {
        label: 'Clear battlefield',
        icon: 'i-lucide-circle-x',
        kbds: ['b-c'],
        onSelect: () => {},
      },
      {
        label: 'Untap all',
        icon: 'i-lucide-rotate-ccw',
        kbds: ['b-u'],
        onSelect: () => {},
      },
      {
        label: 'Destroy all',
        icon: 'i-lucide-bomb',
        kbds: ['b-d'],
        onSelect: () => {},
      },
    ],
  },
  {
    id: 'Graveyard',
    label: 'Graveyard',
    items: [
      {
        label: 'Toggle graveyard window',
        icon: 'i-lucide-skull',
        kbds: ['g-g'],
        onSelect: () => {emit('graveyard_toggleWindow')},
      },
      {
        label: 'Add card to graveyard',
        icon: 'i-lucide-circle-plus',
        kbds: ['g-a'],
        onSelect: () => {},
      },
      {
        label: 'Clear graveyard',
        icon: 'i-lucide-circle-x',
        kbds: ['g-c'],
        onSelect: () => {},
      },
    ],
  },
  {
    id: 'Exile',
    label: 'Exile',
    items: [
      {
        label: 'Toggle exile window',
        icon: 'i-lucide-sparkles',
        kbds: ['e-e'],
        onSelect: () => {},
      },
      {
        label: 'Add card to exile',
        icon: 'i-lucide-diamond-plus',
        kbds: ['e-a'],
        onSelect: () => {},
      },
      {
        label: 'Clear exile',
        icon: 'i-lucide-circle-x',
        kbds: ['e-c'],
        onSelect: () => {},
      },
    ],
  },
]);

const searchTerm = ref('');
</script>
