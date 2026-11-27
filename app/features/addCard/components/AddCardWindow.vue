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
        ref="palette"
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
          <SharedCardImage
            v-if="item.imageUri"
            :landscape="item.landscape"
            frame-class="w-[min(425px,80vw)]"
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

        <!-- In the footer so taps on it count as inside the window. -->
        <template #footer>
          <UFieldGroup
            aria-label="Kinds of card to search"
            size="sm"
          >
            <UButton
              v-for="category in SEARCH_CATEGORIES"
              :key="category.value"
              :label="category.label"
              :icon="
                isPicked(category.value)
                  ? 'i-lucide-square-check'
                  : 'i-lucide-square'
              "
              :aria-pressed="isPicked(category.value)"
              color="neutral"
              :variant="isPicked(category.value) ? 'solid' : 'outline'"
              @click="addCardStore.toggleCategory(category.value)"
            />
          </UFieldGroup>
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
import SharedCardImage from '~/components/shared/CardImage.vue';
import { isLandscapeFace } from '~/features/battlefield/cardFaces';
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UFieldGroup from '@nuxt/ui/components/FieldGroup.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { refDebounced, useOnline } from '@vueuse/core';
import type { Position } from '@vueuse/core';
import { computed, ref, shallowRef, toRef, useTemplateRef } from 'vue';
import { useCloseOnTouchOutside } from '~/composables/useCloseOnTouchOutside';
import type { CommandPaletteItem } from '@nuxt/ui';
import { useAddCard } from '..';
import { pickImageUri } from '~/composables/useScryfall';
import SharedCastDragGhost from '~/components/shared/CastDragGhost.vue';
import { useDragToCast } from '~/composables/useDragToCast';
import { useBattlefieldStore } from '~/features/battlefield';
import type { ScryfallCard } from '~/types/Scryfall';
import { useSettingsStore } from '~/stores/settings';
import { useCardSearch } from '../useCardSearch';
import {
  buildSearchQuery,
  SEARCH_CATEGORIES,
  type SearchCategory,
} from '../searchQuery';
import {
  castSource,
  useCastAnimation,
  type CastSource,
} from '~/features/castAnimation';

const addCardStore = useAddCard();
const settings = useSettingsStore();

const palette = useTemplateRef<{ $el: Element }>('palette');
useCloseOnTouchOutside(
  toRef(addCardStore, 'addCardWindowIsOpen'),
  () => palette.value?.$el,
);

const searchTerm = ref('');
const searchTermDebounced = refDebounced(searchTerm, 500);
// Offline, it doesn't search at all rather than failing each time (#169).
const online = useOnline();
const query = computed(() =>
  online.value
    ? buildSearchQuery(searchTermDebounced.value, addCardStore.categories)
    : '',
);

const isPicked = (category: SearchCategory) =>
  addCardStore.categories.includes(category);

const { cards, status } = useCardSearch(query);

const emptyMessage = computed(() => {
  if (!online.value)
    return "You're offline. Add Card searches Scryfall, so it works again once you're back online.";
  if (!addCardStore.categories.length)
    return 'Pick at least one kind of card to search.';
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
      landscape: isLandscapeFace(card),
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

const animateCast = useCastAnimation();

/** The result last pressed, to fly from when it's tapped (#124). */
let pressed: Element | null = null;

function onSelect(item: CommandPaletteItem) {
  const card = cards.value?.find((f) => f.id === item.id);
  if (!card) return;
  // A tap presses the result first; keyboard picks the highlighted one.
  const from =
    pressed ??
    document.querySelector('[data-highlighted] .add-card-image') ??
    null;
  // Where the board menu opened, if it opened the window (#244).
  cast(card, addCardStore.target ?? undefined, castSource(from));
}

/** Casts a result: to a free spot in view, or centred on a board point. */
function cast(card: ScryfallCard, at?: Position, source?: CastSource | null) {
  const stack = battlefield.castCard(card, 'added', at);
  void animateCast(stack.id, source ?? null);
  pressed = null;

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
  pressed = e.currentTarget as Element;
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
