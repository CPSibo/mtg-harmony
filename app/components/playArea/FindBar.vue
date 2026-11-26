<template>
  <div
    class="find-bar fixed left-1/2 -translate-x-1/2 top-[calc(3.25rem+env(safe-area-inset-top))] flex items-center gap-1 rounded-full bg-elevated/90 ring ring-default shadow-lg ps-1 pe-1 py-1"
    role="search"
    aria-label="Find on board"
  >
    <UInput
      ref="input"
      :model-value="find.query"
      icon="i-lucide-search"
      placeholder="Find on board: name, type or text"
      aria-label="Find on board"
      variant="none"
      autofocus
      class="w-64"
      @update:model-value="(v) => find.setQuery(String(v))"
      @keydown.enter.prevent="
        (e: KeyboardEvent) => (e.shiftKey ? find.previous() : find.next())
      "
      @keydown.esc.prevent="find.close()"
    />
    <span
      class="text-sm text-muted whitespace-nowrap px-1"
      aria-live="polite"
    >
      {{ status }}
    </span>
    <UButton
      icon="i-lucide-chevron-up"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-full"
      title="Previous match (Shift+Enter)"
      aria-label="Previous match"
      :disabled="!find.matches.length"
      @click="find.previous()"
    />
    <UButton
      icon="i-lucide-chevron-down"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-full"
      title="Next match (Enter)"
      aria-label="Next match"
      :disabled="!find.matches.length"
      @click="find.next()"
    />
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-full"
      title="Close (Esc)"
      aria-label="Close find"
      @click="find.close()"
    />
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { computed } from 'vue';
import { useBoardFind } from '~/features/battlefield';

const find = useBoardFind();

const status = computed(() => {
  if (!find.query.trim()) return '';
  const n = find.matches.length;
  return n ? `${find.position} of ${n}` : 'No matches';
});
</script>
