<template>
  <div
    ref="wrapper"
    class="board-wrapper touch-none"
    :style="{ cursor }"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @contextmenu.prevent
    @mousedown="(e) => !box.active && onMouseDown(e)"
    @pointermove="(e) => e.pointerType === 'mouse' && onMouseMove(e)"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
  >
    <!-- The grid, outside the board's transform: a viewport-sized background
         that follows the pan and zoom, so they never repaint a 5000 px layer. -->
    <div
      class="board-backdrop"
      aria-hidden="true"
      :style="backdropStyle"
    />
    <div
      ref="board"
      class="board"
      :class="{ moving: isDragging }"
      :style="style"
    >
      <div
        v-if="!!boardEl"
        class="relative size-full"
      >
        <PlayAreaBoardCardStack
          v-for="stack in battlefield.stacks"
          :key="stack.id"
          v-model:is-dragging="anyCardIsDragging"
          :stack="stack"
          :board="boardEl"
          @show-card-details="showCardDetails"
          @show-card-modifiers="showCardModifiers"
        />
        <PlayAreaDragRadialMenu
          v-if="dragMenu.target.value"
          :key="dragMenu.target.value"
          :board="boardEl"
          :stack-id="dragMenu.target.value"
        />
      </div>
    </div>
    <div
      v-if="boxRect"
      class="selection-box"
      aria-hidden="true"
      :style="boxRect"
    />
  </div>

  <PlayAreaSelectionBar />

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
import PlayAreaDragRadialMenu from '~/components/playArea/DragRadialMenu.vue';
import PlayAreaSelectionBar from '~/components/playArea/SelectionBar.vue';
import { useBlockBrowserZoom } from '~/composables/useBlockBrowserZoom';
import { usePanAndZoom } from '~/composables/usePanAndZoom';
import { storeToRefs } from 'pinia';
import { useEventListener, useWindowSize } from '@vueuse/core';
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watchEffect,
} from 'vue';
import {
  BOARD_SIZE,
  dragMenu,
  useBattlefieldStore,
  useSelectionStore,
} from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { gridLevels } from '~/utils/gridLevels';
import type { BoardCard } from '~/types/PlayArea';

// Card details and modifiers (with the number input) load when the browser is
// idle or on first use, so they stay out of the startup bundle.
const loadCardDetails = () => import('~/components/playArea/CardDetails.vue');
const loadModifiersMenu = () =>
  import('~/components/playArea/ModifiersMenu.vue');
const PlayAreaCardDetails = defineAsyncComponent(loadCardDetails);
const PlayAreaModifiersMenu = defineAsyncComponent(loadModifiersMenu);
window.requestIdleCallback?.(() => {
  void loadCardDetails();
  void loadModifiersMenu();
});

const battlefield = useBattlefieldStore();
const settings = useSettingsStore();
const selection = useSelectionStore();
const { center: centerState } = storeToRefs(battlefield);

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
  size: BOARD_SIZE,
  onEnd: () => {
    // Performance consideration.
    // Watching the center directly does bad
    // stuff, even with `save` being debounced.
    centerState.value = center();
  },
  disabled: () => battlefield.isAttaching,
  smoothing: () => settings.pointerSmoothing,
});

const anyCardIsDragging = ref(false);

// ─── Box selection and clearing (#138) ────────────────────────────────────────
//
// A press on the empty board draws a selection box with Shift held (mouse) or
// in selection mode, instead of panning. Any other press there that doesn't
// move clears the selection.

/** Screen pixels a press may move and still count as a click. */
const CLICK_SLOP = 6;

// Only the handlers read the press; the box's corner is rendered.
const box = { active: false, pointerId: -1, additive: false };
let press: { id: number; x: number; y: number; moved: boolean } | null = null;
const boxStart = { x: 0, y: 0 };
const boxEnd = shallowRef<{ x: number; y: number } | null>(null);

const boxRect = computed(() => {
  const end = boxEnd.value;
  if (!end) return undefined;
  const left = Math.min(boxStart.x, end.x);
  const top = Math.min(boxStart.y, end.y);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.abs(end.x - boxStart.x)}px`,
    height: `${Math.abs(end.y - boxStart.y)}px`,
  };
});

const cursor = computed(() => {
  if (isDragging.value) return 'grabbing';
  return selection.mode ? 'crosshair' : 'grab';
});

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || battlefield.isAttaching || press || box.active) return;
  const target = e.target as Element | null;
  if (target?.closest('[data-stack-id], [data-drag-menu-option]')) return;
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  if ((e.pointerType === 'mouse' && e.shiftKey) || selection.mode) {
    box.active = true;
    box.pointerId = e.pointerId;
    box.additive = e.shiftKey || e.ctrlKey || e.metaKey || selection.mode;
    boxStart.x = e.clientX;
    boxStart.y = e.clientY;
  }
  window.addEventListener('pointermove', onPressMove);
  window.addEventListener('pointerup', onPressEnd);
  window.addEventListener('pointercancel', onPressEnd);
}

function onPressMove(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP)
    press.moved = true;
  if (box.active && press.moved) boxEnd.value = { x: e.clientX, y: e.clientY };
}

function onPressEnd(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return;
  window.removeEventListener('pointermove', onPressMove);
  window.removeEventListener('pointerup', onPressEnd);
  window.removeEventListener('pointercancel', onPressEnd);
  const { moved } = press;
  press = null;
  const end = boxEnd.value;
  boxEnd.value = null;
  const wasBox = box.active;
  box.active = false;
  if (e.type !== 'pointerup') return;
  if (wasBox && moved && end) selectBox(end);
  else if (!moved && !e.shiftKey && !e.ctrlKey && !e.metaKey) selection.clear();
}

function selectBox(end: { x: number; y: number }) {
  const a = battlefield.boardPointFromScreen(boxStart);
  const b = battlefield.boardPointFromScreen(end);
  if (!a || !b) return;
  selection.selectInRect(
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    },
    box.additive,
  );
}

// Esc clears the selection, then leaves selection mode. Dialogs handle their
// own Esc first.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (!selection.size && !selection.mode) return;
  selection.escape();
});

// CSS variables only: the backdrop's gradients scale and move in CSS. The
// grid's finest level is the snap grid; coarser levels take over as you zoom
// out (see `gridLevels`).
const backdropStyle = computed(() => {
  const s = scale.value;
  const { minor, major, minorAlpha } = gridLevels(battlefield.snapScale, s);
  return (
    `--x: ${position.value.x}px; --y: ${position.value.y}px; --s: ${s}; ` +
    `--minor: ${minor * s}px; --major: ${major * s}px; --minor-a: ${minorAlpha}`
  );
});

// Screen pixels at the view's edges that don't count as in view when placing
// a new card: the top, for the corner buttons.
const VIEW_INSET = { top: 64, right: 0, bottom: 0, left: 0 };

const { width: windowWidth, height: windowHeight } = useWindowSize();

// Tells the store what's in view, in board pixels, so cast cards land there,
// and the pan and zoom, so a card dropped on the board lands under the pointer.
watchEffect(() => {
  const s = scale.value;
  battlefield.setTransform({ ...position.value, scale: s });
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

// The centre goes to the store when a pan or zoom ends (`onEnd`), not on
// every frame.
battlefield.setCenter(center());

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
  if (box.active) return;
  onTouchStart(e);
}

function guardedTouchMove(e: TouchEvent) {
  // Always preventDefault on move to block browser scroll / overscroll bounce.
  e.preventDefault();
  if (anyCardIsDragging.value || box.active) return;
  onTouchMove(e);
}

function guardedTouchEnd(e: TouchEvent) {
  if (anyCardIsDragging.value || box.active) return;
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

.selection-box {
  position: absolute;
  pointer-events: none;
  border: 1px dashed var(--ui-primary);
  background: color-mix(in oklab, var(--ui-primary) 15%, transparent);
  border-radius: 2px;
}

.board-backdrop {
  --line: color-mix(in oklab, var(--ui-border-inverted) 8%, transparent);
  --minor-line: color-mix(
    in oklab,
    var(--line) calc(var(--minor-a) * 100%),
    transparent
  );
  --major-line: color-mix(in oklab, var(--ui-border-inverted) 14%, transparent);
  /* Lines stay hairlines at any zoom; the levels keep them apart. */
  --stroke: 1px;

  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    /* Vignette over the whole board, darkest at its edges. */
    radial-gradient(
      circle calc(3500px * var(--s)) at center,
      transparent,
      rgb(0 0 0 / 0.65)
    ),
    /* Major lines along the top and left of each major cell. */
    linear-gradient(to right, var(--major-line) var(--stroke), transparent 0),
    linear-gradient(to bottom, var(--major-line) var(--stroke), transparent 0),
    /* Minor lines, fading out as they close up. */
    linear-gradient(to right, var(--minor-line) var(--stroke), transparent 0),
    linear-gradient(to bottom, var(--minor-line) var(--stroke), transparent 0);
  background-size:
    calc(5000px * var(--s)) calc(5000px * var(--s)),
    var(--major) var(--major),
    var(--major) var(--major),
    var(--minor) var(--minor),
    var(--minor) var(--minor);
  background-repeat: no-repeat, repeat, repeat, repeat, repeat;
  background-position: var(--x) var(--y);
}

.board {
  position: absolute;
  transform-origin: 0 0;
  /* Contains the stacks' and radial menu's z-indexes, so they never rise
     above the palette, side panel or other UI outside the board. */
  isolation: isolate;
  /* A long press is the app's, not the browser's text selection or menu.
     The wrapper also cancels `contextmenu`, which a long press fires on
     Android Chrome and a right-click fires everywhere (#138). */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;

  /* Its own GPU layer while panning, so the compositor moves it without
     repainting. Only then: a layer kept through a zoom would stay rastered
     at the old scale and blur. */
  &.moving {
    will-change: transform;
  }
}
</style>
