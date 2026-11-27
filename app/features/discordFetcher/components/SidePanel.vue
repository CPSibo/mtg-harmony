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
    @after:enter="fullyOpen = true"
  >
    <UButton
      variant="solid"
      color="primary"
      size="xl"
      title="Show on-deck card"
      icon="i-lucide-scan-search"
    >
      <!-- An icon only on phones, where the top row is short of room (#240). -->
      <span class="max-sm:sr-only">On-deck</span>
    </UButton>

    <template #body>
      <!-- A press anywhere in the panel keeps it open after a cast. -->
      <div
        class="contents"
        @pointerdown="stopHold"
      >
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
            :class="{ 'opacity-40': ghost, invisible: faceDown }"
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
            :class="{ 'opacity-40': ghost, invisible: faceDown }"
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
                  cantFetch
                    ? 'i-lucide-wifi-off'
                    : 'i-lucide-arrow-down-to-line'
                "
                class="text-primary text-4xl"
              />
              {{ cantFetch ? 'Offline' : 'Tap to fetch next card' }}
            </div>
          </SharedPlaceholder>

          <!-- The next card face down, until it flips over. After the card, so
             the card stays the display's first child. -->
          <div
            v-if="showBack"
            ref="back"
            class="on-deck-back mtg-card-display"
            aria-hidden="true"
          >
            <UIcon
              name="i-lucide-scan-search"
              class="text-5xl"
            />
          </div>
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
            @click="prev"
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
            @click="clear"
          >
            Clear
          </UButton>
        </div>
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
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import {
  castSource,
  playRevealAnimation,
  reducedMotion,
  useCastAnimation,
  useGraveyardAnimation,
} from '~/features/castAnimation';
import { useDragToCast } from '~/composables/useDragToCast';
import { cardImage, useSelectionStore } from '~/features/battlefield';
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

const settings = useSettingsStore();

const loading = ref(false);

const imageUri = computed(() => (card.value ? cardImage(card.value) : ''));
const landscape = computed(() => !!card.value && isLandscape(card.value));

// The On-deck card blown up to fill the screen, for reading it (#176).
const enlarged = ref(false);
watch(card, () => (enlarged.value = false));

const display = useTemplateRef<HTMLDivElement>('display');
const back = useTemplateRef<HTMLDivElement>('back');

/** How long the next card's flip takes, in ms. */
const REVEAL_DURATION = 500;
/** How long a side pane stays open after a cast, so the flip shows, in ms. */
const HOLD_AFTER_CAST = 750;

/** The panel has finished sliding in, so a flip can be seen whole. */
const fullyOpen = ref(false);

// A new card shows face down, then flips over: at once while the panel is
// open, or once it has opened. 'pending' is face down, waiting.
const reveal = ref<'none' | 'pending' | 'flipping'>('none');
const showBack = computed(
  () => reveal.value !== 'none' && !!card.value && !loading.value,
);
const faceDown = computed(() => reveal.value === 'pending');

/** The card about to show flips over, unless motion is reduced (#212). */
const revealNext = () => {
  reveal.value = reducedMotion() ? 'none' : 'pending';
};

/** The card shown, or the skeleton or placeholder: the display's first child. */
const face = () => display.value?.firstElementChild as HTMLElement | null;

/** Lays the back over the face, which may be landscape or text. */
const placeBack = () => {
  const cardFace = face();
  if (!cardFace || !back.value) return;
  Object.assign(back.value.style, {
    left: `${cardFace.offsetLeft}px`,
    top: `${cardFace.offsetTop}px`,
    width: `${cardFace.offsetWidth}px`,
    height: `${cardFace.offsetHeight}px`,
  });
};

watch(showBack, (shown) => shown && placeBack(), { flush: 'post' });

watch([reveal, fullyOpen, showBack], async () => {
  if (reveal.value !== 'pending' || !fullyOpen.value || !showBack.value) return;
  await nextTick();
  const cardFace = face();
  if (reveal.value !== 'pending' || !cardFace || !back.value) return;

  placeBack();
  reveal.value = 'flipping';
  await playRevealAnimation(cardFace, back.value, REVEAL_DURATION);
  if (reveal.value === 'flipping') reveal.value = 'none';
});

// Opening On-deck is outside selection mode (#235).
const selection = useSelectionStore();
watch(drawerIsOpen, (open) => {
  if (open) selection.setMode(false);
  else {
    fullyOpen.value = false;
    stopHold();
    // Closed mid-flip: the card is face up by the time it opens again.
    if (reveal.value === 'flipping') reveal.value = 'none';
  }
});

/** The panel is a side pane, with the board beside it, not full screen. */
const isSidePane = () => {
  const box = display.value
    ?.closest('[role="dialog"]')
    ?.getBoundingClientRect();
  return !!box && box.width < window.innerWidth;
};

let holdTimer: ReturnType<typeof setTimeout> | undefined;
function stopHold() {
  clearTimeout(holdTimer);
  holdTimer = undefined;
}

/** Closes the panel, once any flip under way has finished. */
function closeOnceFlipped() {
  if (reveal.value === 'flipping') {
    holdTimer = setTimeout(closeOnceFlipped, 50);
    return;
  }
  holdTimer = undefined;
  drawerIsOpen.value = false;
}

/**
 * After a cast the next card shows (Discord reveals one) and flips over. A
 * side pane stays open a moment for that, then closes; a press in it keeps
 * it open. Full screen, it closes at once to uncover the cast, and the flip
 * waits for it to open again; so does a flip whose card hasn't come in time.
 */
const afterCast = (nextCard: Promise<unknown>) => {
  revealNext();
  loading.value = true;
  void nextCard.finally(() => {
    loading.value = false;
    if (!card.value) reveal.value = 'none';
  });

  stopHold();
  if (reveal.value === 'none' || !fullyOpen.value || !isSidePane())
    drawerIsOpen.value = false;
  else holdTimer = setTimeout(closeOnceFlipped, HOLD_AFTER_CAST);
};

const animateCast = useCastAnimation();

const goNext = async () => {
  try {
    revealNext();
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
    if (!card.value) reveal.value = 'none';
  }
};

/** Steps back, showing the card face up: it has been seen. */
const prev = () => {
  reveal.value = 'none';
  discordFetchStore.prev();
};

const clear = () => {
  reveal.value = 'none';
  discordFetchStore.clearCard();
};

/** Casts the card: to a free spot in view, or centred on a board point. */
const cast = (at?: Position) => {
  // Copied before the next card shows; a drop has no flight (#124).
  const source = at ? null : castSource(face());

  // A fresh copy, so casting the same card twice gives two cards (#23).
  const result = discordFetchStore.castToBoard(at);
  if (!result) return;
  void animateCast(result.stack.id, source);
  afterCast(result.next);
};

const animateGraveyard = useGraveyardAnimation();

/** Casts the card without a stack (#175): logged, then gone. */
const castToGraveyard = () => {
  if (!card.value) return;
  const source = castSource(face());
  const nextCard = discordFetchStore.castToGraveyard();
  void animateGraveyard(source);
  afterCast(nextCard);
};

// The panel's actions in the palette (#218). Next and Previous open the panel
// to show the card (#237); the rest work with it closed, and a cast then has
// no flight from the panel.
useWidget({
  id: 'onDeck',
  label: 'On-deck',
  icon: 'i-lucide-scan-search',
  order: 20,
  hideWithSelection: true,
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
      // Each shows only while its button in the panel works (#235).
      enabled: () => !cantFetch.value && !loading.value,
      execute: () => {
        if (cantFetch.value || loading.value) return;
        drawerIsOpen.value = true;
        void goNext();
      },
    },
    {
      id: 'onDeck.previous',
      label: 'Previous card',
      icon: 'i-lucide-arrow-left',
      kbds: 'o-p',
      enabled: () => canGoPrevious.value,
      execute: () => {
        if (!canGoPrevious.value) return;
        drawerIsOpen.value = true;
        prev();
      },
    },
    {
      id: 'onDeck.cast',
      label: 'Cast On-deck card to board',
      icon: 'i-lucide-user-plus',
      kbds: 'o-c',
      enabled: () => !!card.value?.id,
      toast: () => `Cast ${card.value?.scryfallInfo.name} to the board`,
      execute: () => cast(),
      // From the board menu, where it opened (#244).
      executeAt: (at) => cast(at),
    },
    {
      id: 'onDeck.castToGraveyard',
      label: 'Cast On-deck card to graveyard',
      icon: 'i-lucide-skull',
      kbds: 'o-g',
      enabled: () => !!card.value?.id,
      toast: () => `Cast ${card.value?.scryfallInfo.name} to the graveyard`,
      execute: castToGraveyard,
    },
    {
      id: 'onDeck.clear',
      label: 'Clear On-deck card',
      icon: 'i-lucide-x',
      enabled: () => !!card.value?.id,
      toast: () => 'Cleared the On-deck card',
      execute: () => {
        if (card.value) clear();
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

/** How long a drag stays outside the panel before it hides, in ms. */
const HIDE_AFTER_DRAG_OUT = 800;

// While a card is dragged out of the panel, the panel hides after a moment
// to uncover the board behind it. Only where it's a side pane: full screen,
// there's no board beside it to drag to. The panel's box is measured once a
// drag starts; it can't move during one.
let panelBox: DOMRect | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const stopHideTimer = () => {
  clearTimeout(hideTimer);
  hideTimer = undefined;
};

watch(ghost, (at, before) => {
  if (!at) {
    panelBox = null;
    stopHideTimer();
    return;
  }
  if (!before) {
    const panel = display.value?.closest('[role="dialog"]');
    const box = panel?.getBoundingClientRect();
    panelBox = box && box.width < window.innerWidth ? box : null;
  }
  if (!panelBox || !drawerIsOpen.value) return;

  const inside =
    at.x >= panelBox.left &&
    at.x <= panelBox.right &&
    at.y >= panelBox.top &&
    at.y <= panelBox.bottom;
  if (inside) stopHideTimer();
  else
    hideTimer ??= setTimeout(() => {
      hideTimer = undefined;
      drawerIsOpen.value = false;
    }, HIDE_AFTER_DRAG_OUT);
});
</script>

<style lang="scss" scoped>
/* Takes all the height the buttons leave, not a fixed share of it, so the
   card is as big as the panel allows (#176). */
.on-deck-display {
  position: relative;
  flex: 1 1 0;
  min-height: 12rem;
  container-type: size;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* A plain back, not Magic's: the next card face down, laid over its face. */
.on-deck-back {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-primary);
  background:
    radial-gradient(
      circle,
      color-mix(in oklab, var(--ui-primary) 30%, transparent),
      transparent 70%
    ),
    var(--ui-bg-elevated);
  border: 0.4rem solid color-mix(in oklab, var(--ui-primary) 55%, black);
  pointer-events: none;
}

/* As big as fits both ways. */
.on-deck-display > .fit {
  width: min(100cqw, 100cqh * 12 / 17);
  height: auto;
  aspect-ratio: var(--card-ratio-vertical);
}
</style>
