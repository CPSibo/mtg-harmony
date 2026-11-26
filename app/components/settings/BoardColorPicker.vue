<template>
  <div
    class="flex flex-wrap gap-2"
    role="group"
    aria-label="Background colours"
  >
    <button
      v-for="color in BOARD_COLORS"
      :key="color"
      type="button"
      class="board-color"
      :class="{ 'board-color--on': settings.boardColors.includes(color) }"
      :aria-label="BOARD_COLOR_NAMES[color]"
      :aria-pressed="settings.boardColors.includes(color)"
      :title="BOARD_COLOR_NAMES[color]"
      :disabled="!settings.boardBackgroundEnabled"
      @click="settings.toggleBoardColor(color)"
    >
      <span
        class="ms ms-cost ms-shadow"
        :class="`ms-${color.toLowerCase()}`"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
} from '~/features/boardBackground/colors';
import { useSettingsStore } from '~/stores/settings';

const settings = useSettingsStore();
</script>

<style scoped>
.board-color {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  font-size: 1.5rem;
  opacity: 0.35;
  filter: grayscale(0.6);
  transition:
    opacity 0.15s,
    filter 0.15s,
    box-shadow 0.15s;
  cursor: pointer;
}

.board-color--on {
  opacity: 1;
  filter: none;
  box-shadow: 0 0 0 2px var(--ui-primary);
}

.board-color:hover:not(:disabled) {
  opacity: 1;
}

.board-color:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.board-color:disabled {
  cursor: not-allowed;
  opacity: 0.2;
}
</style>
