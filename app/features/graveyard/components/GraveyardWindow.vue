<template>
  <LazyUModal
    ref="graveyardModal"
    v-model:open="graveyardStore.graveyardWindowIsOpen"
    :ui="{
      header:
        'flex flex-row items-stretch justify-stretch px-3 sm:px-6 select-none cursor-grab active:cursor-grabbing bg-taupe-700 text-gray-100 md:text-xl lg:text-2xl',
      body: 'grid grid-cols-3 gap-3 max-h-[50svh]',
    }"
    :modal="false"
    :dismissible="false"
  >
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
        title="Close graveyard"
        color="neutral"
        variant="ghost"
        @click="graveyardStore.closeGraveyardWindow"
      />
    </template>

    <template #body>
      <div
        v-for="card in cards"
        :key="card.id"
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
import { LazyPlayAreaCardDetails } from '#components';
import { useGraveyard } from '..';
import type { BoardCard } from '~/types/PlayArea';

const graveyardStore = useGraveyard();

const cards = computed(() => graveyardStore.cards);

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

const cardDetails = overlay.create(LazyPlayAreaCardDetails);

async function showCardDetais(card: BoardCard) {
  cardDetails.open({
    card,
  });
}
</script>
