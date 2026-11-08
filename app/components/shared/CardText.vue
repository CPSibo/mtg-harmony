<template>
  <!-- A card as text, for when card images are off (#42). Callers that
       stand it in for an image give it role="img" and a label. -->
  <div
    class="card-text flex flex-col gap-1 p-2 bg-elevated text-highlighted rounded-lg border border-default overflow-hidden"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="font-semibold leading-tight">{{ card.name }}</span>
      <span
        v-if="cost.length"
        class="flex flex-wrap justify-end items-center gap-0.5 shrink-0"
      >
        <template
          v-for="(part, i) in cost"
          :key="i"
        >
          <i
            v-if="'symbol' in part"
            :class="part.symbol"
            :title="part.label"
          />
          <span v-else>{{ part.text }}</span>
        </template>
      </span>
    </div>

    <span
      v-if="card.type_line"
      class="text-xs text-muted leading-tight"
    >
      {{ card.type_line }}
    </span>

    <span
      v-if="card.power !== undefined && card.toughness !== undefined"
      class="mt-auto self-end font-semibold"
    >
      {{ card.power }}/{{ card.toughness }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ScryfallCard } from '~/types/Scryfall';
import { manaSymbols } from '~/utils/manaSymbols';

const props = defineProps<{
  card: Pick<
    ScryfallCard,
    'name' | 'mana_cost' | 'type_line' | 'power' | 'toughness'
  >;
}>();

const cost = computed(() => manaSymbols(props.card.mana_cost));
</script>
