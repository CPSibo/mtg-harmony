<template>
  <LazyUModal
    v-if="!!card"
    v-model:open="open"
    :ui="{
      //content: 'min-h-svh',
      body: 'modifiers-menu grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
      header: 'flex justify-between',
      footer: 'flex justify-between',
    }"
    class="min-w-[60svw]"
    scrollable
  >
    <template #title>
      <div
        class="flex items-center gap-3 text-sm md:text-lg lg:text-xl xl:text-2xl"
      >
        <UIcon name="i-lucide-wrench" />
        Modifiers
      </div>
    </template>

    <template #close>
      <UButton
        icon="i-lucide-check"
        color="primary"
        variant="solid"
        size="lg"
        tabindex="0"
      >
        Save & close
      </UButton>
    </template>

    <template #body>
      <div
        v-for="modifier in MODIFIERS"
        :key="modifier.name"
        :class="[
          'modifier-card flex flex-col items-center gap-1 rounded-md border p-4 text-center transition-colors',
          getModCount(modifier.name) > 0
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

        <LazyUInputNumber
          color="secondary"
          :value="getModCount(modifier.name)"
          :min="0"
          @update:model-value="
            (value: number) => {
              if (!card) return;

              const newValue = toValue(value) ?? 0;

              let mod = findMod(modifier.name);

              if (!mod) {
                mod = {
                  modifier,
                  count: 0,
                };

                card.modifiers.add(mod);
              }

              if (newValue === 0) {
                card.modifiers.delete(mod);
              } else {
                mod.count = newValue;
              }
            }
          "
        />
      </div>
    </template>

    <template #footer="{ close }">
      <UButton
        icon="i-lucide-trash"
        color="error"
        variant="ghost"
        size="lg"
        tabindex="-1"
        @click="removeAllCounters"
      >
        Remove all
      </UButton>

      <UButton
        icon="i-lucide-check"
        color="primary"
        variant="solid"
        size="lg"
        tabindex="0"
        @click="close"
      >
        Save & close
      </UButton>
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
import { MODIFIERS } from '~/types/MtgConcepts';
import type { BoardCardModifier, BoardCard } from '~/types/PlayArea';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  card: BoardCard | undefined;
}>();

function findMod(name: string) {
  if (!props.card) return undefined;

  for (const mod of props.card.modifiers) {
    if (mod.modifier.name === name) return mod;
  }

  return undefined;
}

function getModCount(name: string) {
  return findMod(name)?.count ?? 0;
}

const removeAllCounters = () => {
  if (!props.card) return;

  props.card.modifiers = new Set<BoardCardModifier>();
};
</script>

<style lang="css">
.modifier-card {
  /* min-width: 150px; */
}

.modifiers-menu {
  grid-auto-rows: max-content;
}
</style>
