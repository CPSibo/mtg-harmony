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

function handleEmptyClick() {
  if (!card.value && !loading.value) fetch()
}
</script>

<template>
  <!-- Expanded: fills the 2×2 grid span, shows card image prominently -->
  <div
    v-if="onDeckExpanded"
    class="flex h-full flex-col overflow-hidden rounded-md border-2 border-gold-600 bg-gold-950/10 dark:bg-gold-950/20"
    :class="{ 'cursor-pointer': !card && !loading }"
    @click="handleEmptyClick"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center p-2">
      <USkeleton v-if="loading" class="aspect-5/7 h-full max-h-full rounded" />
      <img
        v-else-if="card"
        :src="card.image_uri"
        :alt="card.name"
        class="h-full max-h-full rounded object-contain"
      >
      <div v-else class="flex flex-col items-center gap-2">
        <UIcon name="i-lucide-arrow-down-to-line" class="size-10 text-gold-600 dark:text-gold-400" />
        <p class="text-center text-sm font-medium text-gold-600 dark:text-gold-400">
          Tap to draw a card
        </p>
      </div>
    </div>
    <UProgress v-if="loading" animation="carousel" />
    <div class="flex shrink-0 items-center justify-between gap-2 border-t border-gold-600/40 px-2 py-1.5">
      <div v-if="card" class="flex gap-2">
        <UButton size="sm" :loading="loading" :disabled="loading" @click.stop="fetch">
          Fetch
        </UButton>
        <UButton size="sm" variant="outline" @click.stop="onDeckStore.castCard()">
          Cast
        </UButton>
        <UButton size="sm" variant="ghost" @click.stop="onDeckStore.clearCard()">
          Clear
        </UButton>
      </div>
      <div v-else />
      <UButton
        icon="i-lucide-minimize-2"
        variant="ghost"
        size="sm"
        aria-label="Shrink"
        @click.stop="settingsStore.toggleOnDeckExpanded()"
      />
    </div>
  </div>

  <!-- Shrunk: occupies one grid slot, visually distinct with green accent -->
  <div
    v-else
    :class="[
      'relative flex flex-col overflow-hidden rounded-md border-2 border-gold-600 bg-gold-950/10 dark:bg-gold-950/20',
      gridDisplayMode === 'full' ? 'aspect-5/7' : 'min-h-16',
      !card && !loading ? 'cursor-pointer' : '',
    ]"
    @click="handleEmptyClick"
  >
    <div class="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-1.5" :class="{ 'items-start justify-start': card || loading }">
      <template v-if="loading">
        <USkeleton class="mb-1 h-4 w-3/4 rounded" />
        <USkeleton class="h-4 w-1/2 rounded" />
      </template>
      <template v-else-if="card">
        <p class="truncate text-sm font-medium leading-tight">{{ card.name }}</p>
        <span class="mt-0.5 flex gap-0.5 [&>i:first-child]:ms-0">
          <i v-for="sym in manaSymbols" :key="sym" :class="[sym, 'text-xs']" />
        </span>
        <div class="mt-1.5 flex flex-col items-start gap-0.5">
          <UButton size="xs" :loading="loading" :disabled="loading" @click.stop="fetch">
            Fetch
          </UButton>
          <UButton size="xs" variant="outline" @click.stop="onDeckStore.castCard()">
            Cast
          </UButton>
          <UButton size="xs" variant="ghost" @click.stop="onDeckStore.clearCard()">
            Clear
          </UButton>
        </div>
      </template>
      <div v-else class="flex flex-col items-center gap-1.5">
        <UIcon name="i-lucide-arrow-down-to-line" class="size-6 text-gold-600 dark:text-gold-400" />
        <p class="text-center text-xs font-medium text-gold-600 dark:text-gold-400">
          Tap to draw a card
        </p>
      </div>
    </div>
    <button
      class="absolute bottom-1 right-1 rounded p-0.5 text-gold-600 dark:text-gold-400"
      aria-label="Expand"
      @click.stop="settingsStore.toggleOnDeckExpanded()"
    >
      <UIcon name="i-lucide-maximize-2" class="size-4" />
    </button>
  </div>
</template>
