<template>
  <!-- Around the target's primary card, in board pixels. Only the options
       take the pointer, so the drag can find them under it (#108). -->
  <div
    v-if="box"
    class="drag-radial-menu"
    :style="{
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      '--option-size': `${box.optionSize}px`,
      '--ring-size': `${box.ringSize}px`,
      '--line': `${box.line}px`,
    }"
  >
    <div
      class="ring"
      aria-hidden="true"
    />
    <div
      v-for="option in OPTIONS"
      :key="option.mode"
      class="option"
      :class="[option.side, { active: dragMenu.hovered.value === option.mode }]"
      :data-drag-menu-option="option.mode"
      role="img"
      :aria-label="option.label"
      :title="option.label"
    >
      <UIcon
        :name="option.icon"
        class="size-[55%]"
      />
    </div>
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

// Unders peek out above a card and attachments hang below it, so each
// option sits on that side.
const OPTIONS: {
  mode: AttachMode;
  label: string;
  icon: string;
  side: string;
}[] = [
  {
    mode: 'under',
    label: 'Put under',
    icon: 'i-lucide-arrow-down-to-line',
    side: 'top',
  },
  { mode: 'attach', label: 'Attach to', icon: 'i-lucide-link', side: 'bottom' },
];

const battlefield = useBattlefieldStore();

// Measured once when the menu opens; the board can't pan or zoom mid-drag.
const box = computed(() => {
  const card = props.board.querySelector(
    `[data-drag-target="${CSS.escape(props.stackId)}"]`,
  );
  if (!card) return null;
  const scale = battlefield.boardScale();
  const boardRect = props.board.getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  return {
    x: (rect.left - boardRect.left) / scale,
    y: (rect.top - boardRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
    // Options stay a finger's size (48 px on screen) whatever the zoom.
    optionSize: 48 / scale,
    // A circle through the options, clear of the card's corners.
    ringSize: Math.max(rect.width, rect.height) / scale + 48 / scale,
    line: 2 / scale,
  };
});
</script>

<style lang="scss" scoped>
.drag-radial-menu {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.ring,
.option {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 9999px;
  animation: appear 150ms ease-out;
}

.ring {
  width: var(--ring-size);
  height: var(--ring-size);
  translate: -50% -50%;
  border: var(--line) dashed var(--ui-primary);
  background: color-mix(in oklab, var(--ui-bg) 35%, transparent);
}

/* Centred on the ring, above or below the card. */
.option {
  display: grid;
  place-items: center;
  width: var(--option-size);
  height: var(--option-size);
  pointer-events: auto;
  color: var(--ui-text-inverted);
  background: var(--ui-primary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
  transition:
    scale 100ms ease-out,
    background-color 100ms ease-out;

  &.top {
    translate: -50% calc(-50% - var(--ring-size) / 2);
  }

  &.bottom {
    translate: -50% calc(-50% + var(--ring-size) / 2);
  }

  &.active {
    background: var(--ui-secondary);
    scale: 1.25;
  }
}

@keyframes appear {
  from {
    opacity: 0;
  }
}
</style>
