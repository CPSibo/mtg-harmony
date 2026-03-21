<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()
const { onDeckExpanded } = storeToRefs(settingsStore)

const { loading, fetch } = useScryfall()

const toggleIcon = computed(() =>
  onDeckExpanded.value ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'
)

function parseManaSymbols(manaCost: string): string[] {
  return [...manaCost.matchAll(/\{([^}]+)\}/g)].map((m) => {
    let key = m[1].toLowerCase().replace('/', '')
    if (key === 't') key = 'tap'
    if (key === 'q') key = 'untap'
    return `ms ms-${key} ms-cost`
  })
}

const manaSymbols = computed(() =>
  card.value ? parseManaSymbols(card.value.mana_cost) : []
)
</script>

<template>
  <div class="flex flex-col gap-2 p-2">
    <!-- Controls row -->
    <div class="flex items-center justify-between gap-2">
      <UButton
        :icon="toggleIcon"
        variant="ghost"
        size="sm"
        :aria-label="onDeckExpanded ? 'Collapse' : 'Expand'"
        @click="settingsStore.toggleOnDeckExpanded()"
      />
      <div class="flex gap-2">
        <UButton size="sm" :loading="loading" :disabled="loading" @click="fetch">
          Fetch
        </UButton>
        <UButton size="sm" variant="outline" :disabled="!card" @click="onDeckStore.castCard()">
          Cast
        </UButton>
        <UButton size="sm" variant="ghost" :disabled="!card" @click="onDeckStore.clearCard()">
          Clear
        </UButton>
      </div>
    </div>

    <!-- Loading progress bar -->
    <UProgress v-if="loading" animation="carousel" />

    <!-- Card display — Expanded -->
    <template v-if="onDeckExpanded">
      <USkeleton v-if="loading" class="mx-auto aspect-[5/7] w-full max-w-[200px] rounded-lg" />
      <img
        v-else-if="card"
        :src="card.image_uri"
        :alt="card.name"
        class="mx-auto max-h-80 rounded-lg object-contain"
      />
      <p v-else class="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
        Press Fetch to draw a card
      </p>
    </template>

    <!-- Card display — Collapsed -->
    <template v-else>
      <div v-if="loading" class="flex flex-col gap-1">
        <USkeleton class="h-4 w-36 rounded" />
        <USkeleton class="h-4 w-20 rounded" />
      </div>
      <div v-else-if="card" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
        <span class="text-sm font-medium">{{ card.name }}</span>
        <span class="flex gap-0.5">
          <i v-for="sym in manaSymbols" :key="sym" :class="sym" />
        </span>
      </div>
      <p v-else class="py-1 text-sm text-slate-400 dark:text-slate-500">
        Press Fetch to draw a card
      </p>
    </template>
  </div>
</template>
