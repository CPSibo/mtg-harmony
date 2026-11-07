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
        :loading="status === 'pending' || status === 'idle'"
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
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { refDebounced } from '@vueuse/core';
import { pickImageUri } from '~/composables/useScryfall';
import type { ScryfallCardSearchResponse } from '~/composables/useScryfall';
import { computed, ref, watch } from 'vue';
import type { CommandPaletteItem } from '@nuxt/ui';
import { useAddCard } from '..';
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCardModifier } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';

const addCardStore = useAddCard();

const searchTerm = ref('');
const searchTermDebounced = refDebounced(searchTerm, 500);

// Search Scryfall whenever the debounced term changes, cancelling any request
// still in flight. Scryfall answers "no matches" with a 404 and no `data`.
const cards = ref<ScryfallCard[]>([]);
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle');
let searchAbort: AbortController | undefined;

watch(
  searchTermDebounced,
  async (q) => {
    searchAbort?.abort();
    const abort = (searchAbort = new AbortController());
    status.value = 'pending';
    try {
      const url = new URL('https://api.scryfall.com/cards/search');
      url.searchParams.set('q', q);
      const response = await fetch(url, { signal: abort.signal });
      const body =
        (await response.json()) as Partial<ScryfallCardSearchResponse>;
      cards.value = body.data ?? [];
      status.value = 'success';
    } catch (ex) {
      if (abort.signal.aborted) return;
      console.error('Card search failed.', ex);
      cards.value = [];
      status.value = 'error';
    }
  },
  { immediate: true },
);

const mappedCards = computed(() => {
  return (
    cards.value?.map((card) => ({
      id: card.id,
      label: card.name,
      avatar: {
        src:
          card.image_uris?.border_crop ||
          card.image_uris?.normal ||
          card.image_uris?.small ||
          '',
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

  battlefield.addStackByCard({
    id: card.id,
    scryfallInfo: card,
    name: card.name,
    mana_cost: card.mana_cost,
    image_uri: pickImageUri(card) ?? '',
    scryfall_uri: card.scryfall_uri,
    modifiers: new Set<BoardCardModifier>(),
    tapped: false,
    faceNumber: 0,
  });

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
