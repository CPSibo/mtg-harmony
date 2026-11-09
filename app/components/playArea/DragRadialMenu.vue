<template>
  <!-- Arc segments centred on the target card's top-right corner, in board
       pixels. Only the segments take the pointer, so the drag can find them
       under it (#108). -->
  <div
    v-if="layout"
    class="drag-radial-menu"
    :style="{ left: `${layout.cx}px`, top: `${layout.cy}px` }"
  >
    <svg
      class="arcs"
      width="1"
      height="1"
    >
      <path
        v-for="segment in layout.segments"
        :key="segment.mode"
        class="segment"
        :class="{ active: dragMenu.hovered.value === segment.mode }"
        :d="segment.path"
        :data-drag-menu-option="segment.mode"
        role="img"
        :aria-label="segment.label"
      >
        <title>{{ segment.label }}</title>
      </path>
    </svg>
    <UIcon
      v-for="segment in layout.segments"
      :key="segment.mode"
      :name="segment.icon"
      class="icon"
      :style="{
        left: `${segment.icon_x}px`,
        top: `${segment.icon_y}px`,
        width: `${layout.iconSize}px`,
        height: `${layout.iconSize}px`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import { computed } from 'vue';
import {
  dragMenu,
  useBattlefieldStore,
  type AttachMode,
} from '~/features/battlefield';

const props = defineProps<{
  /** The board's inner element, which the menu is placed in. */
  board: HTMLElement;
  stackId: string;
}>();

/** Clock positions, 12 straight up, going clockwise. */
const OPTIONS: {
  mode: AttachMode;
  label: string;
  icon: string;
  from: number;
  to: number;
}[] = [
  {
    mode: 'attach',
    label: 'Attach to',
    icon: 'i-lucide-link',
    from: 0,
    to: 1.5,
  },
  {
    mode: 'under',
    label: 'Put under',
    icon: 'i-lucide-arrow-down-to-line',
    from: 1.5,
    to: 3,
  },
];

// Sizes on screen, in px; divided by the zoom so they stay finger-sized.
const THICKNESS = 56;
/** From the corner to the segments' inner edge. */
const INNER_RADIUS = 32;
const ICON = 24;
/** Gap between segments, in degrees. */
const SEGMENT_GAP_DEG = 1.5;

const battlefield = useBattlefieldStore();

/** A point `r` from the centre at clock angle `deg` (0 is up). */
function point(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
}

function arcPath(inner: number, outer: number, from: number, to: number) {
  const a = point(outer, from);
  const b = point(outer, to);
  const c = point(inner, to);
  const d = point(inner, from);
  const large = to - from > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}`,
    'Z',
  ].join(' ');
}

// Measured once when the menu opens; the board can't pan or zoom mid-drag.
const layout = computed(() => {
  const card = props.board.querySelector(
    `[data-drag-target="${CSS.escape(props.stackId)}"]`,
  );
  if (!card) return null;
  // The card itself, not its modifiers beside it.
  const face = card.querySelector('.card-image-wrapper') ?? card;
  const scale = battlefield.boardScale();
  const boardRect = props.board.getBoundingClientRect();
  const rect = face.getBoundingClientRect();
  const inner = INNER_RADIUS / scale;
  const outer = inner + THICKNESS / scale;
  const iconSize = ICON / scale;

  return {
    cx: (rect.right - boardRect.left) / scale,
    cy: (rect.top - boardRect.top) / scale,
    iconSize,
    segments: OPTIONS.map((o) => {
      const from = o.from * 30 + SEGMENT_GAP_DEG / 2;
      const to = o.to * 30 - SEGMENT_GAP_DEG / 2;
      const mid = point((inner + outer) / 2, (from + to) / 2);
      return {
        ...o,
        path: arcPath(inner, outer, from, to),
        icon_x: mid.x - iconSize / 2,
        icon_y: mid.y - iconSize / 2,
      };
    }),
  };
});
</script>

<style lang="scss" scoped>
.drag-radial-menu {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  animation: appear 120ms ease-out;
}

.arcs {
  position: absolute;
  overflow: visible;
}

.segment {
  pointer-events: auto;
  fill: var(--ui-primary);
  filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.45));
  transition: fill 100ms ease-out;

  &.active {
    fill: var(--ui-secondary);
  }
}

.icon {
  position: absolute;
  pointer-events: none;
  color: var(--ui-text-inverted);
}

@keyframes appear {
  from {
    opacity: 0;
    scale: 0.9;
  }
}
</style>
