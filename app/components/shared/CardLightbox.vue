<template>
  <!-- A card image as big as the screen allows, for reading it (#176). Any
       tap closes it. -->
  <UModal
    v-model:open="open"
    :title="alt"
    description="Tap anywhere to close"
    :close="false"
    :ui="{
      content:
        'w-auto max-w-none bg-transparent ring-0 shadow-none divide-y-0 cursor-zoom-out',
    }"
  >
    <template #content>
      <SharedCardImage
        :landscape="landscape"
        :frame-style="{ width: 'min(95vw, 90svh * 17 / 12)' }"
        :src="src"
        :alt="alt"
        class="lightbox-card mtg-card-display"
        draggable="false"
        @click="open = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UModal from '@nuxt/ui/components/Modal.vue';
import SharedCardImage from '~/components/shared/CardImage.vue';

defineProps<{ src: string; alt: string; landscape?: boolean }>();

const open = defineModel<boolean>('open', { default: false });
</script>

<style scoped>
/* Portrait: as tall as fits, unless the screen is too narrow for that. */
.lightbox-card {
  display: block;
  width: min(95vw, 90svh * 12 / 17);
  height: auto;
  aspect-ratio: var(--card-ratio-vertical);
}
</style>
