<template>
  <UModal
    v-model:open="addCardStore.addCardWindowIsOpen"
    :ui="{ body: 'flex flex-row gap-3' }"
    title="Add card"
    :modal="false"
    class="min-w-[50svw] top-2 translate-none -translate-x-1/2!"
    @update:open="
      () => {
        searchTerm = '';
      }
    "
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :loading="status === 'pending'"
        :groups="groups"
        class="flex-1 h-80"
        size="xl"
        :ui="{
          group: 'flex flex-row flex-wrap',
          item: 'inline-block w-auto',
          itemLabel: 'hidden',
          itemLeadingAvatar: 'rounded-none add-card-avatar',
          itemTrailingHighlightedIcon: 'hidden',
        }"
        @update:model-value="onSelect"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ emptyMessage }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { refDebounced } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { CommandPaletteItem } from '@nuxt/ui';
import { useAddCard } from '..';
import { pickImageUri } from '~/composables/useScryfall';
import { useBattlefieldStore } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { useCardSearch } from '../useCardSearch';

const addCardStore = useAddCard();
const settings = useSettingsStore();

const searchTerm = ref('');
const searchTermDebounced = refDebounced(searchTerm, 500);

const { cards, status } = useCardSearch(searchTermDebounced);

const emptyMessage = computed(() => {
  if (status.value === 'error') return 'Search failed. Try again.';
  if (status.value === 'success') return 'No cards found.';
  return 'Type a card name to search Scryfall.';
});

const mappedCards = computed(() => {
  return (
    cards.value?.map((card) => ({
      id: card.id,
      label: card.name,
      avatar: !settings.imagesEnabled
        ? undefined
        : {
            src: pickImageUri(card) ?? '',
            loading: 'lazy' as const,
          },
    })) || []
  );
});

const groups = computed(() => [
  {
    id: 'cards',
    items: mappedCards.value,
    // Scryfall already did the search. The palette's own fuzzy filter would
    // run again over these results and hide them (#55).
    ignoreFilter: true,
  },
]);

const battlefield = useBattlefieldStore();

function onSelect(item: CommandPaletteItem) {
  const card = cards.value?.find((f) => f.id === item.id);

  if (!card) return;

  battlefield.castCard(card, 'added');

  cards.value = [];
  searchTerm.value = '';

  addCardStore.closeAddCardWindow();
}
</script>

<style lang="scss">
.add-card-avatar {
  overflow: hidden;
  height: 300px;
  width: auto;
  display: flex;
  align-items: start;
  justify-content: center;

  & > img {
    object-fit: contain;
    object-position: top;
  }
}
</style>
