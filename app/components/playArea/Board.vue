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
    <!-- The grid or themed background, outside the board's transform:
         viewport-sized backgrounds that follow the pan and zoom, so they
         never repaint a 5000 px layer. The themed background's images are
         large, so `useBoardBackground` sets them on a wrapper these inherit
         them from, outside the render a pan triggers. The pan and zoom are
         set once, on the wrapper inside it. From the bottom: the grid lines
         or spotlights, the lattice tiles, then the vignette. -->
    <div
      ref="backgroundVars"
      class="contents"
    >
      <div
        class="contents"
        :style="backdropStyle"
      >
        <div
          class="board-layer board-backdrop"
          :class="{
            'board-backdrop--themed': background.themed.value,
            'board-layer--hidden': !background.shown.value,
          }"
          aria-hidden="true"
        />
        <!-- While one level of detail replaces another, the new tile fades in
           over the old as it fades out, in a group of their own. -->
        <div
          v-if="background.themed.value"
          class="board-layer board-tiles"
          :class="{ 'board-layer--hidden': !background.shown.value }"
          aria-hidden="true"
        >
          <div
            :key="background.fades.value"
            class="board-tile"
            :class="{ 'board-tile--in': background.fading.value }"
          />
          <div
            v-if="background.fading.value"
            :key="`old-${background.fades.value}`"
            class="board-tile board-tile--old"
          />
        </div>
        <div
          class="board-layer board-vignette"
          aria-hidden="true"
        />
      </div>
    </div>
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

  <PlayAreaBoardContextMenu ref="boardMenu" />
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
import PlayAreaBoardContextMenu from '~/components/playArea/BoardContextMenu.vue';
import PlayAreaDragRadialMenu from '~/components/playArea/DragRadialMenu.vue';
import PlayAreaFindBar from '~/components/playArea/FindBar.vue';
import PlayAreaSelectTypeBar from '~/components/playArea/SelectTypeBar.vue';
import { useBlockBrowserZoom } from '~/composables/useBlockBrowserZoom';
import { cardsLabel } from '~/composables/useActionToast';
import { manaIcon } from '~/components/shared/manaIcon';
import { BADGES_HELD } from '~/components/playArea/badgesHeld';
import { usePanAndZoom } from '~/composables/usePanAndZoom';
import { storeToRefs } from 'pinia';
import {
  useDevicePixelRatio,
  useEventListener,
  useMutationObserver,
  useWindowSize,
} from '@vueuse/core';
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
import { createMenuGesture } from '~/features/battlefield/contextMenu';
import { useWidget } from '~/features/widgets';
import { useBoardBackground } from '~/features/boardBackground';
import { useSettingsStore } from '~/stores/settings';
import { gridLevels } from '~/utils/gridLevels';
import { PRESS_SLOP } from '~/utils/press';
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

const anyStacks = () => battlefield.stacks.length > 0;

useWidget({
  id: 'arrange',
  label: 'Arrange',
  icon: 'i-lucide-layout-grid',
  order: 60,
  commands: [
    {
      id: 'arrange.smart',
      toast: smartArrangeToast,
      label: 'Smart arrange',
      description:
        'All cards: creatures in front, lands at the back. Then shows them',
      icon: 'i-lucide-layout-grid',
      kbds: 'a-a',
      enabled: canSmartArrange,
      execute: smartArrange,
    },
    {
      // The same as Smart arrange, on a second shortcut.
      id: 'arrange.smartAndFit',
      toast: smartArrangeToast,
      label: 'Smart arrange',
      icon: 'i-lucide-layout-grid',
      kbds: 'space-space',
      shortcutOnly: true,
      enabled: () => canSmartArrange() && settings.arrangeShortcutEnabled,
      // Space also works a focused button or card; leave it to them.
      shortcutGuard: () => !takesSpace(document.activeElement),
      execute: smartArrange,
    },
  ],
});

/**
 * Smart arrange is all or nothing: it hands the layout and the camera to the
 * app, so it isn't offered for a selection.
 */
function canSmartArrange() {
  return anyStacks() && !selection.size;
}

function smartArrangeToast() {
  return `Arranged ${count(battlefield.stacks.length)} and zoomed to fit`;
}

/** Arranges every stack where the camera can't skew it, then shows them. */
function smartArrange() {
  battlefield.arrangeStacks();
  zoomToStacks();
}

/** "1 card", "3 cards": for the commands' toasts (#237). */
const count = (n: number) => (n === 1 ? '1 card' : `${n} cards`);

/** Whether Space does something of its own on `el`, like pressing a button. */
function takesSpace(el: Element | null) {
  return !!el?.closest(
    'button, a[href], input, textarea, select, [contenteditable], [role="button"], [tabindex]:not([tabindex="-1"])',
  );
}

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
  order: 50,
  hideWithSelection: true,
  commands: [
    {
      id: 'find.open',
      label: 'Find on board',
      description: 'By name, type or text',
      icon: 'i-lucide-search',
      kbds: 'f-b',
      enabled: anyStacks,
      execute: () => {
        selectByType.done();
        find.open();
      },
    },
  ],
});

// ─── Building a selection (#220) ──────────────────────────────────────────────

const selectByType = useSelectByType();

useWidget({
  id: 'select',
  label: 'Select',
  icon: 'i-lucide-square-dashed-mouse-pointer',
  order: 40,
  commands: [
    {
      id: 'select.all',
      toast: () => `Selected all ${count(battlefield.stacks.length)}`,
      label: 'Select all',
      icon: 'i-lucide-square-check-big',
      kbds: 's-a',
      keepsSelectionMode: true,
      enabled: () => battlefield.stacks.length > selection.size,
      execute: () => selection.selectAll(),
    },
    {
      id: 'select.invert',
      toast: () =>
        `Selected the other ${count(battlefield.stacks.length - selection.size)}`,
      label: 'Invert selection',
      icon: 'i-lucide-flip-horizontal-2',
      kbds: 's-i',
      keepsSelectionMode: true,
      enabled: () => selection.size > 0,
      execute: () => selection.invert(),
    },
    {
      id: 'select.tapped',
      toast: () =>
        `Selected ${count(battlefield.stacks.filter((s) => s.primary.tapped).length)}, tapped`,
      label: 'Select tapped',
      icon: 'i-lucide-rotate-cw-square',
      kbds: 's-t',
      keepsSelectionMode: true,
      enabled: () => battlefield.stacks.some((s) => s.primary.tapped),
      execute: () => selection.selectTapped(true),
    },
    {
      id: 'select.untapped',
      toast: () =>
        `Selected ${count(battlefield.stacks.filter((s) => !s.primary.tapped).length)}, untapped`,
      label: 'Select untapped',
      icon: 'i-lucide-square',
      kbds: 's-u',
      keepsSelectionMode: true,
      enabled: () => battlefield.stacks.some((s) => !s.primary.tapped),
      execute: () => selection.selectTapped(false),
    },
    {
      id: 'select.byType',
      label: 'Select by type…',
      description: 'Goblin, creature, artifact…',
      icon: 'i-lucide-text-search',
      kbds: 's-y',
      keepsSelectionMode: true,
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
  order: 30,
  commands: [
    // Structural changes only: cards arriving, leaving or changing stacks
    // (#215). Taps, counters and moves aren't steps.
    {
      id: 'board.undo',
      label: 'Undo',
      description:
        'Take back the last card cast, removed, copied or moved between stacks',
      icon: 'i-lucide-undo-2',
      kbds: 'meta_z',
      keepsSelectionMode: true,
      enabled: () => battlefield.canUndo,
      toast: () => 'Undid the last change',
      execute: () => battlefield.undo(),
    },
    {
      id: 'board.redo',
      label: 'Redo',
      icon: 'i-lucide-redo-2',
      kbds: 'meta_shift_z',
      keepsSelectionMode: true,
      enabled: () => battlefield.canRedo,
      toast: () => 'Redid the change',
      execute: () => battlefield.redo(),
    },
    {
      id: 'board.untapAll',
      toast: () =>
        battlefield.untapAllCount() > 1 ? 'Untapped every card' : '',
      label: 'Untap all',
      icon: 'i-lucide-rotate-ccw',
      kbds: 'u-u',
      enabled: () => battlefield.anyTapped,
      execute: () => battlefield.untapAll(),
    },
    {
      id: 'board.zoomToFit',
      toast: () => 'Zoomed to fit every card',
      label: 'Zoom to fit all cards',
      icon: 'i-lucide-scan',
      kbds: 'z-f',
      enabled: anyStacks,
      execute: () => zoomToStacks(),
    },
    {
      id: 'board.zoomToSelection',
      toast: () => 'Zoomed to the selection',
      label: 'Zoom to selection',
      icon: 'i-lucide-zoom-in',
      kbds: 'z-s',
      enabled: () => selection.size > 0,
      execute: () => zoomToStacks(selection.ids()),
    },
    {
      id: 'board.resetView',
      toast: () => 'Reset the view',
      label: 'Reset view',
      icon: 'i-lucide-locate-fixed',
      kbds: 'z-r',
      execute: resetView,
    },
    {
      id: 'board.selectionMode',
      toast: () => `Selection mode ${selection.mode ? 'off' : 'on'}`,
      label: 'Turn selection mode on or off',
      icon: 'i-lucide-square-dashed-mouse-pointer',
      kbds: 's-m',
      execute: () => selection.setMode(!selection.mode),
    },
    {
      id: 'board.gridSnapping',
      toast: () => `Grid snapping ${battlefield.snapScale ? 'off' : 'on'}`,
      label: 'Turn grid snapping on or off',
      icon: 'i-lucide-grid-3x3',
      execute: () => battlefield.toggleSnapping(),
    },
    {
      id: 'board.artOrText',
      toast: () =>
        `Showing every card as ${settings.imagesEnabled ? 'text' : 'art'}`,
      label: 'Show all cards as art or text',
      description: 'Changes the setting, for every card',
      icon: 'i-lucide-image',
      execute: toggleArtOrText,
    },
  ],
});

const anyCardIsDragging = ref(false);

// ─── Box selection and clearing (#138) ────────────────────────────────────────
//
// A press on the empty board draws a selection box with Shift held (mouse) or
// in selection mode, instead of panning. Any other press there that doesn't
// move clears the selection.

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
  // The board cancels presses to pan, so focus would stay on whatever had it,
  // say On-deck's button, and Space would press it instead of reaching the
  // board's shortcuts (#235). A press on the board lets go of it.
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && !wrapperEl.value?.contains(focused))
    focused.blur();
  const target = e.target as Element | null;
  const onEmptyBoard = !target?.closest(
    '[data-stack-id], [data-drag-menu-option]',
  );
  menuGesture.down(e, onEmptyBoard);
  if (e.button !== 0 || battlefield.isAttaching || press || box.active) return;
  if (!onEmptyBoard) return;
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
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_SLOP)
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
  if (e.type === 'pointerup') {
    if (wasBox && moved && end) selectBox(end);
    // A hold that opened the board menu isn't a tap either (#244).
    else if (
      !moved &&
      !menuGesture.held &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey
    )
      selection.clear();
  }
  // A box drawn is the selection made: selection mode ends with it, whether
  // it caught anything or not (#237).
  if (wasBox && moved) selection.setMode(false);
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

// ─── Board menu (#244) ────────────────────────────────────────────────────────
//
// A right-click that doesn't move, or one finger held still, on empty board
// opens the board menu there. A right-drag still pans; in selection mode a
// touch press draws a box, so holding doesn't open it.

const boardMenuEl = useTemplateRef('boardMenu');

/** macOS, where Ctrl+click is the right-click. */
const isMac = /mac/i.test(
  (navigator as Navigator & { userAgentData?: { platform: string } })
    .userAgentData?.platform ?? navigator.platform,
);

/**
 * Opens the board menu at a screen point. The browser's own `contextmenu`
 * may follow: after a right-click's button comes up and on a Menu keyup
 * (Windows), or for a long press (Android). By then the open menu has taken
 * pointer events from the page, so it lands outside the board, which
 * cancels its own. It's cancelled here instead, wherever it lands.
 */
let swallowContextMenu: ReturnType<typeof setTimeout> | undefined;
function openBoardMenu(at: { x: number; y: number }) {
  boardMenuEl.value?.open(at);
  clearTimeout(swallowContextMenu);
  swallowContextMenu = setTimeout(() => (swallowContextMenu = undefined), 1000);
}
useEventListener(
  window,
  'contextmenu',
  (e: MouseEvent) => {
    if (!e.isTrusted) return;
    // Also any right-click while the menu is open, which closes it.
    if (!swallowContextMenu && !boardMenuEl.value?.isOpen()) return;
    e.preventDefault();
    clearTimeout(swallowContextMenu);
    swallowContextMenu = undefined;
  },
  { capture: true },
);

const menuGesture = createMenuGesture({
  open: openBoardMenu,
  canOpen: () => !battlefield.isAttaching,
  canHold: () => !selection.mode,
  ctrlClickOpens: () => isMac,
});
onUnmounted(menuGesture.dispose);
useEventListener(window, 'pointermove', menuGesture.move, { passive: true });
useEventListener(window, 'pointerup', menuGesture.up, { passive: true });
useEventListener(window, 'pointercancel', menuGesture.cancel, {
  passive: true,
});

// The Menu key or Shift+F10 opens it in the middle of the view, while focus
// is on nothing or on the empty board, not a card, control or dialog.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.defaultPrevented || battlefield.isAttaching) return;
  if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
  const focused = document.activeElement;
  const onBoard =
    !focused ||
    focused === document.body ||
    (!!wrapperEl.value?.contains(focused) &&
      !focused.closest('[data-stack-id]'));
  if (!onBoard) return;
  e.preventDefault();
  openBoardMenu({
    x: windowWidth.value / 2,
    y: (windowHeight.value + VIEW_INSET.top) / 2,
  });
});

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
// out (see `gridLevels`). The themed background has no grid lines.
const backdropStyle = computed(() => {
  const s = scale.value;
  const pan = `--x: ${position.value.x}px; --y: ${position.value.y}px; --s: ${s}`;
  if (background.themed.value) return pan;
  const { minor, major, minorAlpha } = gridLevels(battlefield.snapScale, s);
  return `${pan}; --minor: ${minor * s}px; --major: ${major * s}px; --minor-a: ${minorAlpha}`;
});

// The themed background's tiles and spotlights (#246), rebuilt only when its
// settings change; it reads the pan and zoom from the variables above. The
// backdrop fades out while they're built and back in once they're set. The
// lattice is rendered for the zoom and pixel ratio once the zoom rests, in
// the colours of the theme that shows: Nuxt UI puts `dark` on <html>.
const backgroundVarsEl = useTemplateRef('backgroundVars');
const { pixelRatio } = useDevicePixelRatio();
const root = document.documentElement;
const dark = ref(root.classList.contains('dark'));
useMutationObserver(
  root,
  () => (dark.value = root.classList.contains('dark')),
  { attributeFilter: ['class'] },
);
const background = useBoardBackground(
  () => backgroundVarsEl.value,
  () => settings.boardBackgroundEnabled,
  () => settings.boardColors,
  () => settings.boardSpotlightsEnabled,
  {
    resolution: () => scale.value * pixelRatio.value,
    dark: () => dark.value,
  },
);

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
  // Opening a card is outside selection mode (#235).
  selection.setMode(false);
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

/**
 * Changes the art-or-text setting and lets every card follow it again
 * (#222): a card's own choice would otherwise ignore the change.
 */
function toggleArtOrText() {
  settings.setImagesEnabled(!settings.imagesEnabled);
  battlefield.clearShownAs();
}

const selectedCards = () => selection.stacks().map((s) => s.primary);

const tapIcon = manaIcon(() =>
  selectedCards().some((c) => !c.tapped) ? 'ms-tap' : 'ms-untap',
);
const countersIcon = manaIcon('ms-ability-first-strike');

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
      // One card turning says enough; several get a toast (#237).
      toast: () =>
        selection.size > 1
          ? `${selectedCards().some((c) => !c.tapped) ? 'Tapped' : 'Untapped'} ${cardsLabel(selectedCards())}`
          : '',
      // Tap if any is untapped, else Untap (#235).
      label: () => (selectedCards().some((c) => !c.tapped) ? 'Tap' : 'Untap'),
      // The card's own symbols, as on its details (#237).
      icon: tapIcon,
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
      icon: countersIcon,
      kbds: 'c-c',
      scope: 'selection',
      bar: 'button',
      enabled: () => selection.size > 0,
      execute: () => openForSelection(groupModifiersIsOpen),
    },
    {
      id: 'selection.copy',
      label: 'Copy',
      undoable: true,
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
        toast: () => `Copied ${cardsLabel(selectedCards())}`,
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
    // The less frequent ones, in the bar's "More…" menu (#222).
    {
      id: 'selection.proliferate',
      toast: () =>
        `Proliferated ${cardsLabel(selectedCards().filter((c) => c.modifiers.size > 0))}`,
      label: 'Proliferate',
      description: 'One more of each counter already on each card',
      icon: 'i-lucide-chevrons-up',
      kbds: 'p-p',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selectedCards().some((c) => c.modifiers.size > 0),
      execute: () => battlefield.proliferate(selectedCards()),
    },
    {
      id: 'selection.arrangeRow',
      toast: () => `Arranged ${count(selection.size)} in a row`,
      label: 'Arrange in a row',
      icon: 'i-lucide-columns-3',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 1,
      execute: () => battlefield.arrangeInLine(selection.stacks(), 'row'),
    },
    {
      id: 'selection.arrangeGrid',
      toast: () => `Arranged ${count(selection.size)} in a grid`,
      label: 'Arrange in a grid',
      icon: 'i-lucide-grid-2x2',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 1,
      execute: () => battlefield.arrangeInLine(selection.stacks(), 'grid'),
    },
    {
      id: 'selection.front',
      toast: () => `Brought ${cardsLabel(selectedCards())} to the front`,
      label: 'Bring to front',
      icon: 'i-lucide-bring-to-front',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () => battlefield.bringAllToFront(selection.stacks()),
    },
    {
      id: 'selection.flip',
      toast: () => `Flipped ${cardsLabel(selectedCards())}`,
      label: 'Flip over',
      icon: 'i-lucide-flip-vertical-2',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () => battlefield.flipAll(selectedCards()),
    },
    {
      id: 'selection.explode',
      toast: () => 'Split the stacks into a card each',
      undoable: true,
      label: 'Explode stacks',
      description: 'Each card becomes a stack of its own',
      icon: 'i-lucide-expand',
      scope: 'selection',
      bar: 'menu',
      enabled: () =>
        selection.stacks().some((s) => s.attachments.size || s.unders.size),
      execute: () => battlefield.explodeAll(selection.stacks()),
    },
    {
      id: 'selection.attach',
      label: 'Attach all to…',
      description: 'Then pick the card to attach them to',
      icon: 'i-lucide-link',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () => battlefield.startAttachingAll(selectedCards(), 'attach'),
    },
    {
      id: 'selection.under',
      label: 'Put all under…',
      description: 'Then pick the card to put them under',
      icon: 'i-lucide-layers',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () => battlefield.startAttachingAll(selectedCards(), 'under'),
    },
    {
      id: 'selection.artOrText',
      toast: () =>
        `Showing ${cardsLabel(selectedCards())} as ${settings.imagesEnabled ? 'text' : 'art'}`,
      label: 'Show as art or text',
      description: 'Every card selected changes the setting',
      icon: 'i-lucide-image',
      scope: 'selection',
      bar: 'menu',
      enabled: () => selection.size > 0,
      execute: () =>
        selection.size === battlefield.stacks.length
          ? toggleArtOrText()
          : battlefield.showAllAs(selectedCards(), settings.imagesEnabled),
    },
    {
      id: 'selection.sameName',
      toast: () => 'Selected every card with the same name',
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
      toast: () => 'Cleared the selection',
      label: 'Clear selection',
      icon: 'i-lucide-x',
      scope: 'selection',
      enabled: () => selection.size > 0,
      execute: () => selection.clear(),
    },
  ],
});

const showCardModifiers = (card: BoardCard) => {
  selection.setMode(false);
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

/* The backgrounds behind the board. */
.board-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Fading back in once the background is ready; see useBoardBackground. */
  transition: opacity 0.4s ease-out;
}

/* Faded out while the background is built or swapped. The duration matches
   FADE_OUT_MS. */
.board-layer--hidden {
  opacity: 0;
  transition-duration: 0.15s;
  transition-timing-function: ease-in;
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

  background-image:
    /* Major lines along the top and left of each major cell. */
    linear-gradient(to right, var(--major-line) var(--stroke), transparent 0),
    linear-gradient(to bottom, var(--major-line) var(--stroke), transparent 0),
    /* Minor lines, fading out as they close up. */
    linear-gradient(to right, var(--minor-line) var(--stroke), transparent 0),
    linear-gradient(to bottom, var(--minor-line) var(--stroke), transparent 0);
  background-size:
    var(--major) var(--major),
    var(--major) var(--major),
    var(--minor) var(--minor),
    var(--minor) var(--minor);
  background-position: var(--x) var(--y);
}

/* The themed background (#246) replaces the grid lines with spotlights under
   the lattice tiles, built in the colours of the theme that shows. */
.board-backdrop--themed {
  background-image: var(--spots);
  background-size: calc(var(--spots-width) * var(--s))
    calc(var(--spots-height) * var(--s));
}

/* Isolated so the old tile adds onto the new one only, not what's beneath. */
.board-tiles {
  isolation: isolate;
}

.board-tile {
  position: absolute;
  inset: 0;
  background-image: var(--tile);
  background-size: calc(var(--tile-size) * var(--s))
    calc(var(--tile-size) * var(--s));
  background-position: var(--x) var(--y);
}

/* A crossfade of semi-transparent lines: the new tile at t plus the old at
   1 − t, added rather than layered, so the lines neither double nor dim
   midway. The duration matches LOD_FADE_MS. */
.board-tile--in {
  animation: board-tile-in 0.3s linear both;
}

.board-tile--old {
  background-image: var(--tile-old);
  mix-blend-mode: plus-lighter;
  animation: board-tile-out 0.3s linear both;
}

@keyframes board-tile-in {
  from {
    opacity: 0;
  }
}

@keyframes board-tile-out {
  to {
    opacity: 0;
  }
}

/* Over the whole board, darkest at its edges. */
.board-vignette {
  background-image: radial-gradient(
    circle calc(3500px * var(--s)) at center,
    transparent,
    rgb(0 0 0 / 0.65)
  );
  background-size: calc(5000px * var(--s)) calc(5000px * var(--s));
  background-repeat: no-repeat;
  background-position: var(--x) var(--y);
}

@media (prefers-reduced-motion: reduce) {
  .board-layer {
    transition: none;
  }

  .board-tile--in,
  .board-tile--old {
    animation: none;
  }
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
