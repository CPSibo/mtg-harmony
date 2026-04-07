<template>
  <LazyUModal
    v-model:open="open"
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
  </LazyUModal>
</template>

<script setup lang="ts">
import type { CommandPaletteItem } from '@nuxt/ui';

defineShortcuts({
  'b-a': () => {
    open.value = true;
  },
});

const open = defineModel<boolean>('open');

const searchTerm = ref('');
const searchTermDebounds = refDebounced(searchTerm, 500);

const { data: cards, status } = useLazyFetch(
  'https://api.scryfall.com/cards/search',
  {
    key: 'add-card-widget',
    query: { q: searchTermDebounds },
    transform: (data: ScryfallCardSearchResponse) => {
      return data.data || [];
    },
    server: false,
    immediate: true,
    cache: 'default',
  },
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
  },
]);

const battlefield = useBattlefield();

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
    modifiers: [],
    tapped: false,
    faceNumber: 0,
  });

  cards.value = [];
  searchTerm.value = '';
  open.value = false;
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
