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
  <PlayAreaFindBar v-if="find.isOpen" />
  <PlayAreaSelectTypeBar v-if="selectByType.isOpen" />

  <PlayAreaCardDetails
    v-model:open="cardDetailsIsOpen"
    :card="windowCard"
    @show-card-modifiers="showCardModifiers"
  />

  <PlayAreaModifiersMenu
    v-model:open="cardModifiersIsOpen"
    :card="windowCard"
    @after:leave="badgesHeld = null"
  />

  <PlayAreaGroupModifiersMenu
    v-model:open="groupModifiersIsOpen"
    :cards="targetCards"
  />

  <PlayAreaRemoveCardsModal
    v-model:open="removeIsOpen"
    :cards="targetCards"
    @removed="selection.clear()"
  />

  <PlayAreaRoomDoorsModal v-if="battlefield.doorChoice" />
</template>

<script setup lang="ts">
import PlayAreaBoardCardStack from '~/components/playArea/BoardCardStack.vue';
import PlayAreaDragRadialMenu from '~/components/playArea/DragRadialMenu.vue';
import PlayAreaSelectionBar from '~/components/playArea/SelectionBar.vue';
import PlayAreaFindBar from '~/components/playArea/FindBar.vue';
import PlayAreaSelectTypeBar from '~/components/playArea/SelectTypeBar.vue';
import { useBlockBrowserZoom } from '~/composables/useBlockBrowserZoom';
import { BADGES_HELD } from '~/components/playArea/badgesHeld';
import { usePanAndZoom } from '~/composables/usePanAndZoom';
import { storeToRefs } from 'pinia';
import { useEventListener, useWindowSize } from '@vueuse/core';
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
  watchEffect,
  type Ref,
} from 'vue';
import {
  BOARD_SIZE,
  boundingRect,
  dragMenu,
  useBattlefieldStore,
  useBoardFind,
  useSelectByType,
  useSelectionStore,
} from '~/features/battlefield';
import { useCopyAllAnimation } from '~/features/castAnimation';
import { useWidget } from '~/features/widgets';
import { useSettingsStore } from '~/stores/settings';
import { gridLevels } from '~/utils/gridLevels';
import { whenIdle } from '~/utils/whenIdle';
import type { BoardCard } from '~/types/PlayArea';

// Card details and modifiers (with the number input) load when the browser is
// idle or on first use, so they stay out of the startup bundle.
const loadCardDetails = () => import('~/components/playArea/CardDetails.vue');
const loadModifiersMenu = () =>
  import('~/components/playArea/ModifiersMenu.vue');
const PlayAreaCardDetails = defineAsyncComponent(loadCardDetails);
const PlayAreaModifiersMenu = defineAsyncComponent(loadModifiersMenu);
// Only a Room cast to the board opens it (#145).
// The selection's windows (#221) load on first use.
const PlayAreaGroupModifiersMenu = defineAsyncComponent(
  () => import('~/components/playArea/GroupModifiersMenu.vue'),
);
const PlayAreaRemoveCardsModal = defineAsyncComponent(
  () => import('~/components/playArea/RemoveCardsModal.vue'),
);
const PlayAreaRoomDoorsModal = defineAsyncComponent(
  () => import('~/components/playArea/RoomDoorsModal.vue'),
);
whenIdle(() => {
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
  panBy,
  centreOn,
  fitRect,
  resetView,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
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

// Smart arrange (#223): the selection, or every stack with none selected.
useWidget({
  id: 'arrange',
  label: 'Arrange',
  icon: 'i-lucide-layout-grid',
  commands: [
    {
      id: 'arrange.smart',
      label: 'Smart arrange',
      description:
        'Creatures in front, lands at the back. The selection, or all cards',
      icon: 'i-lucide-layout-grid',
      kbds: 'a-a',
      execute: () =>
        battlefield.arrangeStacks(
          selection.size
            ? battlefield.stacks.filter((s) => selection.has(s.id))
            : battlefield.stacks,
        ),
    },
  ],
});

// ─── Find on board (#219) ─────────────────────────────────────────────────────

const find = useBoardFind();

// Bring the current match into view as the query or the step changes.
watch(
  () => find.current,
  (stack) => {
    if (!stack || !find.isOpen) return;
    const { width, height } = battlefield.stackSize(stack);
    centreOn(stack.position.x + width / 2, stack.position.y + height / 2);
  },
);

useWidget({
  id: 'find',
  label: 'Find',
  icon: 'i-lucide-search',
  commands: [
    {
      id: 'find.open',
      label: 'Find on board',
      description: 'By name, type or text',
      icon: 'i-lucide-search',
      kbds: 'f-b',
      execute: () => {
        selectByType.done();
        find.open();
      },
    },
  ],
});

// ─── Building a selection (#220) ──────────────────────────────────────────────

const selectByType = useSelectByType();
const anyStacks = () => battlefield.stacks.length > 0;

useWidget({
  id: 'select',
  label: 'Select',
  icon: 'i-lucide-square-dashed-mouse-pointer',
  commands: [
    {
      id: 'select.all',
      label: 'Select all',
      icon: 'i-lucide-square-check-big',
      kbds: 's-a',
      enabled: anyStacks,
      execute: () => selection.selectAll(),
    },
    {
      id: 'select.invert',
      label: 'Invert selection',
      icon: 'i-lucide-flip-horizontal-2',
      kbds: 's-i',
      enabled: anyStacks,
      execute: () => selection.invert(),
    },
    {
      id: 'select.tapped',
      label: 'Select tapped',
      icon: 'i-lucide-rotate-cw-square',
      kbds: 's-t',
      enabled: () => battlefield.stacks.some((s) => s.primary.tapped),
      execute: () => selection.selectTapped(true),
    },
    {
      id: 'select.untapped',
      label: 'Select untapped',
      icon: 'i-lucide-square',
      kbds: 's-u',
      enabled: () => battlefield.stacks.some((s) => !s.primary.tapped),
      execute: () => selection.selectTapped(false),
    },
    {
      id: 'select.byType',
      label: 'Select by type…',
      description: 'Goblin, creature, artifact…',
      icon: 'i-lucide-text-search',
      kbds: 's-y',
      enabled: anyStacks,
      execute: () => {
        find.close();
        selectByType.open();
      },
    },
  ],
});

// ─── Board commands in the palette (#218) ─────────────────────────────────────

/** Shows every stack in `ids`, or the middle of the board if there's none. */
function zoomToStacks(ids?: readonly string[]) {
  const stacks = ids
    ? battlefield.stacks.filter((s) => ids.includes(s.id))
    : battlefield.stacks;
  const rect = boundingRect(
    stacks.map((s) => ({ ...s.position, ...battlefield.stackSize(s) })),
  );
  if (rect) fitRect(rect);
  else resetView();
}

useWidget({
  id: 'board',
  label: 'Board',
  icon: 'i-lucide-layout-dashboard',
  commands: [
    {
      id: 'board.untapAll',
      label: 'Untap all',
      icon: 'i-lucide-rotate-ccw',
      kbds: 'u-u',
      execute: () => battlefield.untapAll(),
    },
    {
      id: 'board.zoomToFit',
      label: 'Zoom to fit all cards',
      icon: 'i-lucide-scan',
      kbds: 'z-f',
      execute: () => zoomToStacks(),
    },
    {
      id: 'board.zoomToSelection',
      label: 'Zoom to selection',
      description: 'All cards when nothing is selected',
      icon: 'i-lucide-zoom-in',
      kbds: 'z-s',
      execute: () => zoomToStacks(selection.size ? selection.ids() : undefined),
    },
    {
      id: 'board.resetView',
      label: 'Reset view',
      icon: 'i-lucide-locate-fixed',
      kbds: 'z-r',
      execute: resetView,
    },
    {
      id: 'board.selectionMode',
      label: 'Turn selection mode on or off',
      icon: 'i-lucide-square-dashed-mouse-pointer',
      kbds: 's-m',
      execute: () => selection.setMode(!selection.mode),
    },
    {
      id: 'board.gridSnapping',
      label: 'Turn grid snapping on or off',
      icon: 'i-lucide-grid-3x3',
      execute: () => battlefield.toggleSnapping(),
    },
    {
      id: 'board.artOrText',
      label: 'Show all cards as art or text',
      description: 'Changes the setting; cards set on their own keep it',
      icon: 'i-lucide-image',
      execute: () => settings.setImagesEnabled(!settings.imagesEnabled),
    },
  ],
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

// Tab to a card off screen makes the browser scroll the wrapper to it, which
// the pan and the pointer maths know nothing about. Undo the scroll and pan
// the same distance instead, so the card still comes into view (#170).
useEventListener(wrapperEl, 'scroll', () => {
  const el = wrapperEl.value;
  if (!el || (!el.scrollLeft && !el.scrollTop)) return;
  const { scrollLeft, scrollTop } = el;
  el.scrollLeft = 0;
  el.scrollTop = 0;
  panBy(-scrollLeft, -scrollTop);
});

// Esc stops attaching (#170), else clears the selection, then leaves
// selection mode. Dialogs handle their own Esc first.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (battlefield.isAttaching) return battlefield.cancelAttaching();
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
  el.addEventListener('touchcancel', onTouchCancel, { passive: true });
});

onUnmounted(() => {
  const el = wrapperEl.value;
  if (!el) return;

  el.removeEventListener('touchstart', guardedTouchStart);
  el.removeEventListener('touchmove', guardedTouchMove);
  el.removeEventListener('touchend', guardedTouchEnd);
  el.removeEventListener('touchcancel', onTouchCancel);
});

// The touch handlers above pan and zoom the board; this stops Safari zooming
// the page as well.
useBlockBrowserZoom(wrapperEl);

// ─────────────────────────────────────────────────────────────────────────────

// The card the details and modifiers windows show. Kept after they close, so
// they can animate out; it isn't the target of anything (the selection is).
const windowCard = ref<BoardCard | undefined>();

const cardDetailsIsOpen = ref(false);

const showCardDetails = (card: BoardCard) => {
  // A double tap selects the stack on its first tap. Opening the card is an
  // action of its own, so it leaves nothing selected (#216).
  const [only] = selection.stacks();
  if (
    selection.size === 1 &&
    only &&
    (only.primary === card ||
      only.attachments.has(card) ||
      only.unders.has(card))
  )
    selection.clear();
  windowCard.value = card;
  cardModifiersIsOpen.value = false;
  cardDetailsIsOpen.value = true;
};

const cardModifiersIsOpen = ref(false);

// Held from opening until the window has finished closing (#204).
const badgesHeld = shallowRef<BoardCard | null>(null);
provide(BADGES_HELD, badgesHeld);

// The selection's cards, fixed when a selection window opens (#221), so the
// window keeps them even if the selection changes behind it.
const targetCards = shallowRef<BoardCard[]>([]);
const groupModifiersIsOpen = ref(false);
const removeIsOpen = ref(false);
const copyAll = useCopyAllAnimation();

function openForSelection(window: Ref<boolean>) {
  targetCards.value = selection.stacks().map((s) => s.primary);
  window.value = true;
}

// Selection commands of the board's own (#216). Others come from the features
// that own them.
useWidget({
  id: 'boardSelection',
  label: 'Selection',
  icon: 'i-lucide-square-dashed-mouse-pointer',
  commands: [
    {
      id: 'selection.details',
      label: 'Show card details',
      icon: 'i-lucide-ellipsis',
      scope: 'selection',
      enabled: () => selection.size === 1,
      execute: () => {
        const stack = selection.stacks()[0];
        if (stack) showCardDetails(stack.primary);
      },
    },
    {
      id: 'selection.tap',
      label: 'Tap or untap',
      description: 'Taps them all if any is untapped, else untaps them',
      icon: 'i-lucide-rotate-cw-square',
      kbds: 't-t',
      scope: 'selection',
      bar: 'button',
      enabled: () => selection.size > 0,
      execute: () =>
        battlefield.tapOrUntap(selection.stacks().map((s) => s.primary)),
    },
    {
      id: 'selection.counters',
      label: 'Counters and keywords…',
      icon: 'i-lucide-wrench',
      kbds: 'c-c',
      scope: 'selection',
      bar: 'button',
      enabled: () => selection.size > 0,
      execute: () => openForSelection(groupModifiersIsOpen),
    },
    {
      id: 'selection.copy',
      label: 'Copy',
      icon: 'i-lucide-copy',
      scope: 'selection',
      bar: 'button',
      enabled: () => selection.size > 0,
      choices: (
        [
          ['card', 'Copy: card only', 'i-lucide-copy'],
          ['counters', 'Copy: with counters', 'i-lucide-copy-plus'],
          ['stack', 'Copy: everything', 'i-lucide-layers'],
        ] as const
      ).map(([mode, label, icon]) => ({
        label,
        icon,
        execute: () =>
          copyAll(
            selection.stacks().map((s) => s.primary),
            mode,
          ),
      })),
      execute: () => {},
    },
    {
      id: 'selection.remove',
      label: 'Remove…',
      icon: 'i-lucide-trash',
      kbds: 'r-r',
      scope: 'selection',
      bar: 'button',
      enabled: () => selection.size > 0,
      execute: () => openForSelection(removeIsOpen),
    },
    {
      id: 'selection.sameName',
      label: 'Select all with the same name',
      icon: 'i-lucide-copy-check',
      kbds: 's-n',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () => selection.selectSameName(),
    },
    {
      id: 'selection.clear',
      label: 'Clear selection',
      icon: 'i-lucide-x',
      scope: 'selection',
      enabled: () => selection.size > 0,
      execute: () => selection.clear(),
    },
  ],
});

const showCardModifiers = (card: BoardCard) => {
  windowCard.value = card;
  badgesHeld.value = card;
  cardDetailsIsOpen.value = false;
  cardModifiersIsOpen.value = true;
};
</script>

<style lang="css" scoped>
.board-wrapper {
  width: 100svw;
  height: 100svh;
  position: relative;
  /* clip, not hidden: a hidden box can still be scrolled, and focusing a card
     partly off-screen did, shifting the board behind the pan's back (#212).
     Panning moves the board with a transform; nothing here should scroll. */
  overflow: clip;
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
