<template>
  <USlideover
    v-model:open="drawerIsOpen"
    side="left"
    title="On-deck"
    description="Fetch random non-land, paper cards"
    :modal="false"
    :dismissible="false"
    :ui="{
      overlay: 'bg-elevated',
      content: 'border-primary-900! border-r-3',
    }"
  >
    <UButton
      variant="solid"
      color="primary"
      size="xl"
      title="Show on-deck card"
      icon="i-lucide-scan-search"
    >
      On-deck
    </UButton>

    <template #body>
      <div
        ref="display"
        class="on-deck-display"
      >
        <USkeleton
          v-if="loading"
          class="mtg-card-display vertical"
        />
        <img
          v-else-if="!!card?.image_uri && settings.imagesEnabled"
          :src="card?.image_uri"
          :alt="card?.name ?? 'Missing card'"
          class="mtg-card-display vertical cursor-grab touch-none select-none"
          :class="{ 'opacity-40': ghost }"
          draggable="false"
          title="Drag onto the board to cast"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
        />
        <SharedCardText
          v-else-if="!!card"
          :card="card.scryfallInfo"
          role="img"
          :aria-label="card.name"
          class="h-full cursor-grab touch-none select-none"
          :class="{ 'opacity-40': ghost }"
          title="Drag onto the board to cast"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
        />
        <SharedPlaceholder
          v-else
          class="cursor-pointer mtg-card-display vertical"
          @click="goNext"
        >
          <div class="flex flex-col gap-3 items-center">
            <UIcon
              name="i-lucide-arrow-down-to-line"
              class="text-primary text-4xl"
            />
            Tap to fetch next card
          </div>
        </SharedPlaceholder>
      </div>

      <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-arrow-left"
          :disabled="!canGoPrevious"
          size="xl"
          @click="discordFetchStore.prev"
        >
          Prev card
        </UButton>

        <UButton
          color="primary"
          variant="subtle"
          icon="i-lucide-arrow-right"
          :loading="loading"
          size="xl"
          @click="goNext"
        >
          Next card
        </UButton>

        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-user-plus"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="cast()"
        >
          Cast to board
        </UButton>

        <UButton
          color="error"
          variant="ghost"
          icon="i-lucide-x"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="discordFetchStore.clearCard"
        >
          Clear
        </UButton>
      </div>
    </template>
  </USlideover>

  <SharedCastDragGhost
    v-if="card"
    :card="card.scryfallInfo"
    :image-uri="card.image_uri"
    :at="ghost"
    :width="ghostWidth"
  />
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import USkeleton from '@nuxt/ui/components/Skeleton.vue';
import USlideover from '@nuxt/ui/components/Slideover.vue';
import SharedCardText from '~/components/shared/CardText.vue';
import SharedCastDragGhost from '~/components/shared/CastDragGhost.vue';
import SharedPlaceholder from '~/components/shared/Placeholder.vue';
import { useSettingsStore } from '~/stores/settings';
import { useToast } from '@nuxt/ui/composables';
import { storeToRefs } from 'pinia';
import type { Position } from '@vueuse/core';
import { ref, useTemplateRef } from 'vue';
import { castSource, useCastAnimation } from '~/features/castAnimation';
import { useDragToCast } from '~/composables/useDragToCast';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '..';

const toast = useToast();

const drawerIsOpen = ref(false);

const discordFetchStore = useDiscordFetcherStore();
const { card, canGoPrevious } = storeToRefs(discordFetchStore);

const board = useBattlefieldStore();
const settings = useSettingsStore();

const loading = ref(false);

const display = useTemplateRef<HTMLDivElement>('display');
const animateCast = useCastAnimation();

const goNext = async () => {
  try {
    loading.value = true;

    const result = await discordFetchStore.next();

    if (!result.success) {
      toast.add({
        title: 'Fetch Error',
        description: result.error ?? 'Could not fetch card',
        color: 'error',
      });
    }
  } finally {
    loading.value = false;
  }
};

/** Casts the card: to a free spot in view, or centred on a board point. */
const cast = (at?: Position) => {
  if (!card.value) return;

  // Measured before the drawer closes; a drop has no flight (#124).
  const source = at ? null : castSource(display.value?.firstElementChild);

  // A fresh copy, so casting the same card twice gives two cards (#23).
  const stack = board.castCard(card.value.scryfallInfo, 'cast', at);
  void animateCast(stack.id, source);

  discordFetchStore.clearCard();

  drawerIsOpen.value = false;
};

// Drag to the board (#79).
const {
  ghost,
  ghostWidth,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cancelDrag,
} = useDragToCast({ onDrop: (at) => cast(at) });
</script>

<style lang="scss" scoped>
.on-deck-display {
  height: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
