<template>
  <LazyUModal
    v-model:open="open"
    :ui="{
      header:
        'flex flex-row items-stretch justify-stretch px-3 sm:px-6 select-none cursor-grab active:cursor-grabbing bg-taupe-700 text-gray-100 md:text-xl lg:text-2xl',
      body: 'grid grid-cols-3 gap-3 max-h-[50svh]',
    }"
    :modal="false"
    :dismissible="false"
    ref="graveyardModal"
  >
    <UButton
      class="fixed bottom-3 right-3 min-w-0 p-2 bg-taupe-700 text-gray-100 active:bg-taupe-500 hover:bg-taupe-500"
    >
      <UIcon
        name="i-lucide-skull"
        :size="40"
      />
    </UButton>

    <template #header>
      <div
        ref="dragHandle"
        class="flex flex-row justify-start items-center gap-2 grow touch-none"
      >
        <UIcon name="i-lucide-skull" />
        Graveyard
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>

    <template #body>
      <div
        v-for="card in cards"
        v-if="cards?.length"
        @click="showCardDetais(card)"
      >
        <img
          :src="card.image_uri"
          :alt="card.name"
          class="mtg-card-display"
        />
      </div>
      <UEmpty
        v-else
        class="col-span-3"
        title="Graveyard empty"
        description="Destroyed cards will appear here"
        icon="i-lucide-bone"
        size="xl"
        variant="soft"
      />
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
import type { BoardCard } from '~/types/PlayArea';

const open = defineModel<boolean>('open');

defineShortcuts({
  'g-g': () => {
    open.value = !open.value;
  },
});

const graveyard = useGraveyard();
const cards = computed(() => graveyard.cards);

const dragHandle = useTemplateRef('dragHandle');
const modalPanel = computed(
  () => dragHandle.value?.closest('[role="dialog"]') as HTMLElement | null,
);

const { x, y, style } = useDraggable(modalPanel, {
  handle: dragHandle,
  containerElement: document.documentElement,
  preventDefault: true,
  stopPropagation: false,
});

watch(style, async () => {
  if (modalPanel.value) {
    modalPanel.value.style.position = 'fixed';
    modalPanel.value.style.translate = `${x.value}px ${y.value}px`;
    modalPanel.value.style.top = '0';
    modalPanel.value.style.left = '0';
  }
});

const overlay = useOverlay();

import { LazyPlayAreaCardDetails } from '#components';

const cardDetails = overlay.create(LazyPlayAreaCardDetails);

async function showCardDetais(card: BoardCard) {
  cardDetails.open({
    card,
  });
}
</script>
