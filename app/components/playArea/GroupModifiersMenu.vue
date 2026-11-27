<template>
  <UModal
    v-model:open="open"
    :ui="{
      body: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 auto-rows-max',
      footer: 'flex justify-between',
    }"
    class="min-w-[60svw]"
    scrollable
    :title="`Counters and keywords on ${cards.length} cards`"
    description="Adds to or takes from each card's own count"
  >
    <template #body>
      <div
        v-for="modifier in MODIFIERS"
        :key="modifier.key"
        :class="[
          'flex flex-col items-center gap-1 rounded-md border p-4 text-center transition-colors',
          holders(modifier.key) > 0
            ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
            : 'border-neutral-200 dark:border-neutral-700',
        ]"
      >
        <span
          :class="modifier.symbol"
          class="ms-2x"
        />
        <span class="truncate text-neutral-700 dark:text-neutral-300">
          {{ modifier.name }}
        </span>
        <span class="text-xs text-muted">
          {{
            holders(modifier.key)
              ? `on ${holders(modifier.key)} of ${cards.length}`
              : 'on none'
          }}
        </span>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-minus"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="`Remove ${modifier.name}`"
            :disabled="!holders(modifier.key)"
            @click="battlefield.changeModifier(cards, modifier.key, -1)"
          />
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="`Add ${modifier.name}`"
            @click="battlefield.changeModifier(cards, modifier.key, 1)"
          />
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton
        icon="i-lucide-trash"
        color="error"
        variant="ghost"
        size="lg"
        @click="battlefield.clearModifiersOf(cards)"
      >
        Clear all
      </UButton>
      <UButton
        icon="i-lucide-check"
        color="primary"
        size="lg"
        @click="close"
      >
        Done
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { MODIFIERS, type ModifierKey } from '~/types/MtgConcepts';
import type { BoardCard } from '~/types/PlayArea';

/**
 * Counters and keywords on several cards at once (#221). Each button changes
 * every card's own count by one, so a card with three +1/+1 counters gets a
 * fourth rather than being set to one.
 */
const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ cards: readonly BoardCard[] }>();

const battlefield = useBattlefieldStore();

/** How many of the cards have `key`. */
const holders = (key: ModifierKey) =>
  props.cards.filter((c) => (c.modifiers.get(key) ?? 0) > 0).length;
</script>
