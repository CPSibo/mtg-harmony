<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()

const { loading, fetch } = useScryfall()

function handleEmptyClick() {
  if (!card.value && !loading.value) fetch()
}
</script>

<template>
  <div
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
</template>
