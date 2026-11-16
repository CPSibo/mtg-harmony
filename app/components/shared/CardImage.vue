<template>
  <!-- Scryfall's images are portrait, with landscape cards printed sideways
       in them. A landscape card gets a sideways frame, sized by the caller
       through `frameClass`, with the image turned a quarter clockwise in it
       so it reads face-up. -->
  <div
    v-if="landscape"
    class="landscape-frame"
    :class="frameClass"
    :style="frameStyle"
  >
    <img
      v-bind="$attrs"
      class="landscape-image"
    />
  </div>
  <img
    v-else
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
  landscape?: boolean;
  /** Sizes the sideways frame; give it one dimension, the ratio sets the other. */
  frameClass?: string;
  frameStyle?: Record<string, string>;
}>();
</script>

<style scoped>
.landscape-frame {
  position: relative;
  flex-shrink: 0;
  aspect-ratio: var(--card-ratio-horizontal);
  container-type: size;
}

/* Two classes, so the caller's own width and height classes lose. */
.landscape-frame > .landscape-image {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100cqh;
  height: 100cqw;
  max-width: none;
  max-height: none;
  aspect-ratio: auto;
  translate: -50% -50%;
  rotate: 90deg;
}
</style>
