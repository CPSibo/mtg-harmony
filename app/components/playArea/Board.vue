<template>
  <div
    ref="wrapper"
    class="board-wrapper touch-none"
    :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
  >
    <div
      ref="board"
      class="board"
      :style="style"
    >
      <SharedGrid v-if="!!boardEl">
        <PlayAreaBoardCardStack
          v-for="stack in orderedStacks"
          :key="stack.id"
          v-model:is-dragging="anyCardIsDragging"
          :stack="stack"
          :board="boardEl"
          :scale="scale"
          @show-card-details="showCardDetails"
          @show-card-modifiers="showCardModifiers"
        />
      </SharedGrid>
    </div>
  </div>

  <PlayAreaCardDetails
    v-model:open="cardDetailsIsOpen"
    :card="selectedCard"
    @show-card-modifiers="showCardModifiers"
  />

  <PlayAreaModifiersMenu
    v-model:open="cardModifiersIsOpen"
    :card="selectedCard"
  />
</template>

<script setup lang="ts">
import PlayAreaBoardCardStack from '~/components/playArea/BoardCardStack.vue';
import PlayAreaCardDetails from '~/components/playArea/CardDetails.vue';
import PlayAreaModifiersMenu from '~/components/playArea/ModifiersMenu.vue';
import SharedGrid from '~/components/shared/Grid.vue';
import { useBlockBrowserZoom } from '~/composables/useBlockBrowserZoom';
import { usePanAndZoom } from '~/composables/usePanAndZoom';
import { storeToRefs } from 'pinia';
import { useWindowSize } from '@vueuse/core';
import {
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
  watchEffect,
} from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';

const battlefield = useBattlefieldStore();
const { orderedStacks, center: centerState } = storeToRefs(battlefield);

const wrapperEl = useTemplateRef('wrapper');
const boardEl = useTemplateRef('board');

const {
  center,
  position,
  scale,
  style,
  isDragging,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
} = usePanAndZoom({
  size: { width: 5000, height: 5000 },
  onEnd: () => {
    // Performance consideration.
    // Watching the center directly does bad
    // stuff, even with `save` being debounced.
    centerState.value = center.value;
  },
  disabled: () => battlefield.isAttaching,
});

const anyCardIsDragging = ref(false);

// Screen pixels at the view's edges that don't count as in view when placing
// a new card: the top, for the corner buttons.
const VIEW_INSET = { top: 64, right: 0, bottom: 0, left: 0 };

const { width: windowWidth, height: windowHeight } = useWindowSize();

// Tells the store what's in view, in board pixels, so cast cards land there.
watchEffect(() => {
  const s = scale.value;
  battlefield.setView({
    x: (VIEW_INSET.left - position.value.x) / s,
    y: (VIEW_INSET.top - position.value.y) / s,
    width: Math.max(
      0,
      (windowWidth.value - VIEW_INSET.left - VIEW_INSET.right) / s,
    ),
    height: Math.max(
      0,
      (windowHeight.value - VIEW_INSET.top - VIEW_INSET.bottom) / s,
    ),
  });
});

watch(
  center,
  (value) => {
    battlefield.setCenter(value);
  },
  { immediate: true, deep: true },
);

// ─── Imperative touch listeners ───────────────────────────────────────────────
//
// We CANNOT use Vue's @touchstart.stop.prevent / @touchmove.stop.prevent here.
// Those compile to bubble-phase listeners and call stopPropagation(), which
// races with VueUse's capture-phase listeners on child card stacks and
// intermittently breaks either board pan OR card button taps.
//
// Instead we register { passive: false } so we can call preventDefault()
// (blocking browser scroll / native pan) without calling stopPropagation()
// (so child elements still receive the events for their own tap/drag handling).

function guardedTouchStart(e: TouchEvent) {
  if (anyCardIsDragging.value) return;
  e.preventDefault();
  onTouchStart(e);
}

function guardedTouchMove(e: TouchEvent) {
  // Always preventDefault on move to block browser scroll / overscroll bounce.
  e.preventDefault();
  if (anyCardIsDragging.value) return;
  onTouchMove(e);
}

function guardedTouchEnd(e: TouchEvent) {
  if (anyCardIsDragging.value) return;
  onTouchEnd(e);
  // No preventDefault here — we want the browser to synthesise
  // click/tap events so UButton and other child controls work.
}

onMounted(() => {
  const el = wrapperEl.value;
  if (!el) return;

  el.addEventListener('touchstart', guardedTouchStart, { passive: false });
  el.addEventListener('touchmove', guardedTouchMove, { passive: false });
  el.addEventListener('touchend', guardedTouchEnd, { passive: true });
});

onUnmounted(() => {
  const el = wrapperEl.value;
  if (!el) return;

  el.removeEventListener('touchstart', guardedTouchStart);
  el.removeEventListener('touchmove', guardedTouchMove);
  el.removeEventListener('touchend', guardedTouchEnd);
});

// The touch handlers above pan and zoom the board; this stops Safari zooming
// the page as well.
useBlockBrowserZoom(wrapperEl);

// ─────────────────────────────────────────────────────────────────────────────

const selectedCard = ref<BoardCard | undefined>();

const cardDetailsIsOpen = ref(false);

const showCardDetails = (card: BoardCard) => {
  selectedCard.value = card;
  cardModifiersIsOpen.value = false;
  cardDetailsIsOpen.value = true;
};

const cardModifiersIsOpen = ref(false);

const showCardModifiers = (card: BoardCard) => {
  selectedCard.value = card;
  cardDetailsIsOpen.value = false;
  cardModifiersIsOpen.value = true;
};
</script>

<style lang="css" scoped>
.board-wrapper {
  width: 100svw;
  height: 100svh;
  position: relative;
  overflow: hidden;
  contain: strict; /* Disable CLS hints for children. */
}

.board {
  position: absolute;
  transform-origin: 0 0;
  /* A long press is the app's, not the browser's text selection or menu. */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
</style>
