<template>
  <!-- A group of settings inside a tab. Its heading is small and muted, so it reads as part of the tab
       rather than as another tab when the tabs collapse into one page. -->
  <section
    class="flex flex-col gap-6 not-first:mt-4"
    :aria-labelledby="id"
  >
    <component
      :is="level"
      :id="id"
      class="flex items-center gap-3 text-xs font-semibold tracking-wider text-muted uppercase after:h-px after:flex-1 after:bg-(--ui-border)"
    >
      {{ title }}
    </component>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue';

withDefaults(defineProps<{ title: string; level?: 'h3' | 'h4' }>(), {
  level: 'h3',
});

const id = useId();
</script>
