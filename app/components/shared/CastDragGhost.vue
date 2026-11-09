<template>
  <!-- What follows the pointer while dragging a card onto the board. -->
  <Teleport to="body">
    <template v-if="at">
      <img
        v-if="imageUri && settings.imagesEnabled"
        :src="imageUri"
        alt=""
        aria-hidden="true"
        class="drag-ghost"
        :style="style"
      />
      <SharedCardText
        v-else
        :card="card"
        aria-hidden="true"
        class="drag-ghost"
        :style="style"
      />
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import type { Position } from '@vueuse/core';
import { computed } from 'vue';
import SharedCardText from '~/components/shared/CardText.vue';
import { useSettingsStore } from '~/stores/settings';
import type { ScryfallCard } from '~/types/Scryfall';

const props = defineProps<{
  card: ScryfallCard;
  imageUri?: string | null;
  /** The ghost's centre in screen px, or null when not dragging. */
  at: Position | null;
  width: number;
}>();

const settings = useSettingsStore();

const style = computed(() => ({
  left: `${props.at?.x ?? 0}px`,
  top: `${props.at?.y ?? 0}px`,
  width: `${props.width}px`,
}));
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
</style>
