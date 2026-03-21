<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()
const { onDeckExpanded, gridDisplayMode } = storeToRefs(settingsStore)

const { loading, fetch } = useScryfall()

function parseManaSymbols(manaCost: string): string[] {
  return [...manaCost.matchAll(/\{([^}]+)\}/g)].map((m) => {
    let key = m[1]!.toLowerCase().replace('/', '')
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
  <!-- Expanded: fills the 2×2 grid span, shows card image prominently -->
  <div
    v-if="onDeckExpanded"
    class="flex h-full flex-col overflow-hidden rounded-md border-2 border-green-600 bg-green-950/20 dark:bg-green-950/40"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center p-2">
      <USkeleton v-if="loading" class="aspect-5/7 h-full max-h-full rounded" />
      <img
        v-else-if="card"
        :src="card.image_uri"
        :alt="card.name"
        class="h-full max-h-full rounded object-contain"
      >
      <p v-else class="text-center text-sm text-slate-400 dark:text-slate-500">
        Press Fetch to draw a card
      </p>
    </div>
    <UProgress v-if="loading" animation="carousel" />
    <div class="flex shrink-0 items-center justify-between gap-2 border-t border-green-600/40 px-2 py-1.5">
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
      <UButton
        icon="i-lucide-minimize-2"
        variant="ghost"
        size="sm"
        aria-label="Shrink"
        @click="settingsStore.toggleOnDeckExpanded()"
      />
    </div>
  </div>

  <!-- Shrunk: occupies one grid slot, visually distinct with green accent -->
  <div
    v-else
    :class="[
      'relative flex flex-col overflow-hidden rounded-md border-2 border-green-600 bg-green-950/10 dark:bg-green-950/30',
      gridDisplayMode === 'full' ? 'aspect-5/7' : 'min-h-16',
    ]"
  >
    <div class="flex min-h-0 flex-1 flex-col justify-center px-2 py-1.5">
      <template v-if="loading">
        <USkeleton class="mb-1 h-4 w-3/4 rounded" />
        <USkeleton class="h-4 w-1/2 rounded" />
      </template>
      <template v-else-if="card">
        <p class="truncate text-sm font-medium leading-tight">{{ card.name }}</p>
        <span class="flex gap-0.5">
          <i v-for="sym in manaSymbols" :key="sym" :class="[sym, 'text-xs']" />
        </span>
      </template>
      <p v-else class="text-xs leading-tight text-slate-400 dark:text-slate-500">
        On deck
      </p>
    </div>
    <button
      class="absolute bottom-1 right-1 rounded p-0.5 text-green-600 hover:bg-green-600/20"
      aria-label="Expand"
      @click="settingsStore.toggleOnDeckExpanded()"
    >
      <UIcon name="i-lucide-maximize-2" class="size-4" />
    </button>
  </div>
</template>
