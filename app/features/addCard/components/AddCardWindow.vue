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
          itemTrailingHighlightedIcon: 'hidden',
        }"
        @update:model-value="onSelect"
      >
        <!-- Tap a result to cast it to a free spot, or drag it onto the
             board to cast it there, like On-deck (#113). -->
        <template #item-leading="{ item }">
          <img
            v-if="item.imageUri"
            :src="item.imageUri"
            :alt="item.label"
            loading="lazy"
            draggable="false"
            title="Tap to cast, or drag onto the board"
            class="add-card-image cursor-grab touch-none select-none"
            :class="{ 'opacity-40': ghost && dragged?.id === item.id }"
            @pointerdown="startDrag($event, item.id)"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="cancelDrag"
          />
          <span
            v-else
            title="Tap to cast, or drag onto the board"
            class="cursor-grab touch-none select-none"
            :class="{ 'opacity-40': ghost && dragged?.id === item.id }"
            @pointerdown="startDrag($event, item.id)"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="cancelDrag"
          >
            {{ item.label }}
          </span>
        </template>

        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ emptyMessage }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>

  <SharedCastDragGhost
    v-if="dragged"
    :card="dragged"
    :image-uri="pickImageUri(dragged)"
    :at="ghost"
    :width="ghostWidth"
  />
</template>

<script setup lang="ts">
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { refDebounced } from '@vueuse/core';
import type { Position } from '@vueuse/core';
import { computed, ref, shallowRef } from 'vue';
import type { CommandPaletteItem } from '@nuxt/ui';
import { useAddCard } from '..';
import { pickImageUri } from '~/composables/useScryfall';
import SharedCastDragGhost from '~/components/shared/CastDragGhost.vue';
import { useDragToCast } from '~/composables/useDragToCast';
import { useBattlefieldStore } from '~/features/battlefield';
import type { ScryfallCard } from '~/types/Scryfall';
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
      imageUri: settings.imagesEnabled ? pickImageUri(card) : null,
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
  if (card) cast(card);
}

/** Casts a result: to a free spot in view, or centred on a board point. */
function cast(card: ScryfallCard, at?: Position) {
  battlefield.castCard(card, 'added', at);

  cards.value = [];
  searchTerm.value = '';

  addCardStore.closeAddCardWindow();
}

// Drag a result onto the board (#113).

/** The result being pressed or dragged. */
const dragged = shallowRef<ScryfallCard | null>(null);

const {
  ghost,
  ghostWidth,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cancelDrag,
} = useDragToCast({
  onDrop: (at) => {
    if (dragged.value) cast(dragged.value, at);
  },
});

function startDrag(e: PointerEvent, id: string) {
  dragged.value = cards.value?.find((f) => f.id === id) ?? null;
  if (dragged.value) onPointerDown(e);
}
</script>

<style lang="scss">
.add-card-image {
  height: 300px;
  width: auto;
  object-fit: contain;
  object-position: top;
}
</style>
