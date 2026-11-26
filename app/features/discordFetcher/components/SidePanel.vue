<template>
  <USlideover
    v-model:open="drawerIsOpen"
    side="left"
    title="On-deck"
    description="Fetch random non-land, paper cards"
    :modal="false"
    :dismissible="false"
    :content="{ onCloseAutoFocus: keepFocusElsewhere }"
    :ui="{
      overlay: 'bg-elevated',
      content: 'border-primary-900! border-r-3',
      body: 'flex flex-col',
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
          class="mtg-card-display fit"
        />
        <SharedCardImage
          v-else-if="!!imageUri && settings.imagesEnabled"
          :landscape="landscape"
          :frame-style="{ width: 'min(100cqw, 100cqh * 17 / 12)' }"
          :src="imageUri"
          :alt="card?.scryfallInfo.name ?? 'Missing card'"
          class="mtg-card-display fit cursor-grab touch-none select-none"
          :class="{ 'opacity-40': ghost }"
          draggable="false"
          tabindex="0"
          title="Tap to enlarge, or drag onto the board to cast"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
          @click="enlarged = true"
          @keydown.enter.prevent="enlarged = true"
          @keydown.space.prevent="enlarged = true"
        />
        <SharedCardText
          v-else-if="!!card"
          :card="card.scryfallInfo"
          role="img"
          :aria-label="card.scryfallInfo.name"
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
          class="mtg-card-display fit"
          :class="{ 'cursor-pointer': !cantFetch }"
          @click="!cantFetch && goNext()"
        >
          <div class="flex flex-col gap-3 items-center text-center">
            <UIcon
              :name="
                cantFetch ? 'i-lucide-wifi-off' : 'i-lucide-arrow-down-to-line'
              "
              class="text-primary text-4xl"
            />
            {{ cantFetch ? 'Offline' : 'Tap to fetch next card' }}
          </div>
        </SharedPlaceholder>
      </div>

      <p
        v-if="!online"
        role="status"
        class="mt-3 flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-wifi-off"
          class="shrink-0"
        />
        {{ OFFLINE_MESSAGE }}
      </p>

      <div class="mt-5 grid shrink-0 grid-cols-1 md:grid-cols-2 gap-4">
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
          :disabled="cantFetch"
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

        <!-- For what doesn't stay, such as instants and sorceries (#175). -->
        <UButton
          color="info"
          variant="subtle"
          icon="i-lucide-skull"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="castToGraveyard"
        >
          Cast to graveyard
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

  <SharedCardLightbox
    v-if="imageUri"
    v-model:open="enlarged"
    :src="imageUri"
    :alt="card?.scryfallInfo.name ?? ''"
    :landscape="landscape"
  />

  <SharedCastDragGhost
    v-if="card"
    :card="card.scryfallInfo"
    :image-uri="cardImage(card)"
    :at="ghost"
    :width="ghostWidth"
  />
</template>

<script setup lang="ts">
import SharedCardImage from '~/components/shared/CardImage.vue';
import { isLandscape } from '~/features/battlefield/cardFaces';
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import USkeleton from '@nuxt/ui/components/Skeleton.vue';
import USlideover from '@nuxt/ui/components/Slideover.vue';
import SharedCardLightbox from '~/components/shared/CardLightbox.vue';
import SharedCardText from '~/components/shared/CardText.vue';
import SharedCastDragGhost from '~/components/shared/CastDragGhost.vue';
import SharedPlaceholder from '~/components/shared/Placeholder.vue';
import { useSettingsStore } from '~/stores/settings';
import { useToast } from '@nuxt/ui/composables';
import { storeToRefs } from 'pinia';
import { useOnline, type Position } from '@vueuse/core';
import { computed, ref, useTemplateRef, watch } from 'vue';
import {
  castSource,
  useCastAnimation,
  useGraveyardAnimation,
} from '~/features/castAnimation';
import { useDragToCast } from '~/composables/useDragToCast';
import { cardImage, useBattlefieldStore } from '~/features/battlefield';
import { OFFLINE_MESSAGE, useDiscordFetcherStore } from '..';
import { useWidget } from '~/features/widgets';
import { keepFocusElsewhere } from '~/utils/keepFocusElsewhere';

const toast = useToast();

const drawerIsOpen = ref(false);

const discordFetchStore = useDiscordFetcherStore();
const { card, canGoPrevious, nextNeedsNetwork } =
  storeToRefs(discordFetchStore);

// Offline, Next card still works through cards already queued or shown (#169).
const online = useOnline();
const cantFetch = computed(() => !online.value && nextNeedsNetwork.value);

const board = useBattlefieldStore();
const settings = useSettingsStore();

const loading = ref(false);

const imageUri = computed(() => (card.value ? cardImage(card.value) : ''));
const landscape = computed(() => !!card.value && isLandscape(card.value));

// The On-deck card blown up to fill the screen, for reading it (#176).
const enlarged = ref(false);
watch(card, () => (enlarged.value = false));

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

const animateGraveyard = useGraveyardAnimation();

/** Casts the card without a stack (#175): logged, then gone. */
const castToGraveyard = () => {
  if (!card.value) return;
  const source = castSource(display.value?.firstElementChild);
  discordFetchStore.castToGraveyard();
  void animateGraveyard(source);
  drawerIsOpen.value = false;
};

// The panel's actions in the palette (#218). Each works with the panel
// closed; a cast then has no flight from the panel.
useWidget({
  id: 'onDeck',
  label: 'On-deck',
  icon: 'i-lucide-scan-search',
  commands: [
    {
      id: 'onDeck.toggle',
      label: 'Show or hide On-deck',
      icon: 'i-lucide-scan-search',
      kbds: 'o-o',
      execute: () => (drawerIsOpen.value = !drawerIsOpen.value),
    },
    {
      id: 'onDeck.next',
      label: 'Next card',
      icon: 'i-lucide-arrow-right',
      kbds: 'o-n',
      execute: () => {
        if (!cantFetch.value && !loading.value) void goNext();
      },
    },
    {
      id: 'onDeck.previous',
      label: 'Previous card',
      icon: 'i-lucide-arrow-left',
      kbds: 'o-p',
      execute: () => {
        if (canGoPrevious.value) discordFetchStore.prev();
      },
    },
    {
      id: 'onDeck.cast',
      label: 'Cast On-deck card to board',
      icon: 'i-lucide-user-plus',
      kbds: 'o-c',
      execute: () => cast(),
    },
    {
      id: 'onDeck.castToGraveyard',
      label: 'Cast On-deck card to graveyard',
      icon: 'i-lucide-skull',
      kbds: 'o-g',
      execute: castToGraveyard,
    },
    {
      id: 'onDeck.clear',
      label: 'Clear On-deck card',
      icon: 'i-lucide-x',
      execute: () => {
        if (card.value) discordFetchStore.clearCard();
      },
    },
  ],
});

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
/* Takes all the height the buttons leave, not a fixed share of it, so the
   card is as big as the panel allows (#176). */
.on-deck-display {
  flex: 1 1 0;
  min-height: 12rem;
  container-type: size;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* As big as fits both ways. */
.on-deck-display > .fit {
  width: min(100cqw, 100cqh * 12 / 17);
  height: auto;
  aspect-ratio: var(--card-ratio-vertical);
}
</style>
