<template>
  <LazyUModal
    v-if="!!card"
    v-model:open="open"
    :ui="{
      body: 'modifiers-menu grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
      header: 'flex justify-between',
    }"
    fullscreen
  >
    <template #header="{ close }">
      <div
        class="flex items-center gap-3 text-sm md:text-lg lg:text-xl xl:text-2xl"
      >
        <UIcon name="i-lucide-wrench" />
        Modifiers
      </div>

      <div
        class="text-sm md:text-lg lg:text-xl xl:text-2xl flex gap-3 md:gap-6 lg:gap-12"
      >
        <UButton
          icon="i-lucide-trash"
          color="error"
          tabindex="-1"
          @click="removeAllCounters"
        >
          Remove all
        </UButton>

        <UButton
          icon="i-lucide-check"
          color="primary"
          tabindex="0"
          @click="close"
        >
          Save
        </UButton>
      </div>
    </template>

    <template #body>
      <div
        v-for="modifier in MODIFIERS"
        :key="modifier.name"
        :class="[
          'modifier-card flex flex-col items-center gap-1 rounded-md border p-4 text-center transition-colors',
          (card.modifiers.find((f) => f.modifier.name === modifier.name)
            ?.count ?? 0) > 0
            ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
            : 'border-neutral-200 dark:border-neutral-600',
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
          :value="
            card.modifiers.find((f) => f.modifier.name === modifier.name)
              ?.count ?? 0
          "
          :min="0"
          @update:model-value="
            (value: number) => {
              if (!card) return;

              const newValue = toValue(value) ?? 0;

              let mod = card.modifiers.find(
                (f) => f.modifier.name === modifier.name,
              );

              if (!mod) {
                mod = {
                  modifier,
                  count: 0,
                };

                card.modifiers.push(mod);
              }

              if (newValue === 0) {
                card.modifiers = card.modifiers.filter((f) => f !== mod);
              } else {
                mod.count = newValue;
              }
            }
          "
        />
      </div>
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
import { MODIFIERS } from '~/types/MtgConcepts';
import type { BoardCard } from '~/types/PlayArea';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  card: BoardCard | undefined;
}>();

const removeAllCounters = () => {
  if (!props.card) return;

  props.card.modifiers = [];
};
</script>

<style lang="css">
.modifier-card {
  min-width: 150px;
}

.modifiers-menu {
  grid-auto-rows: max-content;
}
</style>
