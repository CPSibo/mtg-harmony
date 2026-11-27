<template>
  <div
    class="select-type-bar fixed left-1/2 -translate-x-1/2 top-[calc(3.25rem+env(safe-area-inset-top))] flex items-center gap-1 rounded-full bg-elevated/90 ring ring-default shadow-lg ps-1 pe-1 py-1"
    role="search"
    aria-label="Select by type"
  >
    <UInput
      :model-value="select.query"
      icon="i-lucide-square-dashed-mouse-pointer"
      placeholder="Select by type, e.g. Goblin"
      aria-label="Select by type"
      variant="none"
      autofocus
      class="w-64"
      @update:model-value="(v) => select.setQuery(String(v))"
      @keydown.enter.prevent="select.done()"
      @keydown.esc.prevent="select.cancel()"
    />
    <span
      class="text-sm text-muted whitespace-nowrap px-1"
      aria-live="polite"
    >
      {{ status }}
    </span>
    <UButton
      icon="i-lucide-check"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-full"
      title="Done (Enter)"
      aria-label="Done"
      @click="select.done()"
    />
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-full"
      title="Cancel (Esc)"
      aria-label="Cancel"
      @click="select.cancel()"
    />
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { computed } from 'vue';
import { useSelectByType } from '~/features/battlefield';

// Select by type (#220): selects as the player types.
const select = useSelectByType();

const status = computed(() => {
  if (!select.query.trim()) return '';
  const n = select.matches.length;
  if (!n) return 'No matches';
  return n === 1 ? '1 stack' : `${n} stacks`;
});
</script>
