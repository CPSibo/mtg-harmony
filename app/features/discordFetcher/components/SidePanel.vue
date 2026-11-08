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
      <div class="on-deck-display">
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

  <!-- What follows the pointer while dragging the card to the board. -->
  <Teleport to="body">
    <img
      v-if="ghost && card?.image_uri && settings.imagesEnabled"
      :src="card.image_uri"
      alt=""
      aria-hidden="true"
      class="drag-ghost"
      :style="{
        left: `${ghost.x}px`,
        top: `${ghost.y}px`,
        width: `${ghostWidth}px`,
      }"
    />
    <SharedCardText
      v-else-if="ghost && card"
      :card="card.scryfallInfo"
      aria-hidden="true"
      class="drag-ghost"
      :style="{
        left: `${ghost.x}px`,
        top: `${ghost.y}px`,
        width: `${ghostWidth}px`,
      }"
    />
  </Teleport>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import USkeleton from '@nuxt/ui/components/Skeleton.vue';
import USlideover from '@nuxt/ui/components/Slideover.vue';
import SharedCardText from '~/components/shared/CardText.vue';
import SharedPlaceholder from '~/components/shared/Placeholder.vue';
import { useSettingsStore } from '~/stores/settings';
import { useToast } from '@nuxt/ui/composables';
import { storeToRefs } from 'pinia';
import type { Position } from '@vueuse/core';
import { computed, ref } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '..';

const toast = useToast();

const drawerIsOpen = ref(false);

const discordFetchStore = useDiscordFetcherStore();
const { card, canGoPrevious } = storeToRefs(discordFetchStore);

const board = useBattlefieldStore();
const settings = useSettingsStore();

const loading = ref(false);

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

  // A fresh copy, so casting the same card twice gives two cards (#23).
  board.castCard(card.value.scryfallInfo, 'cast', at);

  discordFetchStore.clearCard();

  drawerIsOpen.value = false;
};

// ─── Drag to the board (#79) ─────────────────────────────────────────────────

/** How far the pointer moves before a press becomes a drag, in screen px. */
const DRAG_THRESHOLD = 6;

/** A card's width on the board, in board px (BoardCard at the stack's scale). */
const BOARD_CARD_WIDTH = 172;

let pressedAt: (Position & { id: number }) | null = null;

/** Where the ghost's centre is, in screen px, while dragging. */
const ghost = ref<Position | null>(null);

// The size the card will land at, so the drop matches what's shown.
const ghostWidth = computed(
  () => BOARD_CARD_WIDTH * (board.transform?.scale ?? 1),
);

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !card.value) return;
  pressedAt = { x: e.clientX, y: e.clientY, id: e.pointerId };
  (e.target as Element).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!pressedAt || e.pointerId !== pressedAt.id) return;
  const moved = Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y);
  if (!ghost.value && moved < DRAG_THRESHOLD) return;
  ghost.value = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e: PointerEvent) {
  if (!pressedAt || e.pointerId !== pressedAt.id) return;
  const dropped = ghost.value;
  cancelDrag();
  if (!dropped) return; // A tap, not a drag.

  // Back on the panel, or off the board, cancels.
  const under = document.elementFromPoint(dropped.x, dropped.y);
  if (!under?.closest('.board-wrapper')) return;

  const at = board.boardPointFromScreen(dropped);
  if (at) cast(at);
}

function cancelDrag() {
  pressedAt = null;
  ghost.value = null;
}
</script>

<style lang="scss" scoped>
.drag-ghost {
  position: fixed;
  z-index: 100;
  transform: translate(-50%, -50%) rotate(-3deg);
  pointer-events: none;
  opacity: 0.85;
  border-radius: 4%;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
}

.on-deck-display {
  height: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
