<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()

const { loading, fetch } = useScryfall()

// ─── Deferred cast / clear ────────────────────────────────────────────────────

/** Set before calling the store so the card exit animation plays first. */
const pendingAction = ref<'cast' | 'clear' | null>(null)

/** Exit transform for the card image — upward for cast, shrink for clear. */
const cardLeaveToClass = computed(() =>
  pendingAction.value === 'cast'
    ? 'opacity-0 -translate-y-4 scale-105'
    : 'opacity-0 scale-75'
)

function handleCast() {
  if (pendingAction.value || !card.value) return
  pendingAction.value = 'cast'
}

function handleClear() {
  if (pendingAction.value || !card.value) return
  pendingAction.value = 'clear'
}

/** Called by @after-leave — by this point the card image has fully exited. */
function executePendingAction() {
  if (pendingAction.value === 'cast') onDeckStore.castCard()
  else if (pendingAction.value === 'clear') onDeckStore.clearCard()
  pendingAction.value = null
}

function handleEmptyClick() {
  if (!card.value && !loading.value && !pendingAction.value) fetch()
}
</script>

<template>
  <div
    class="flex h-full flex-col overflow-hidden rounded-md border-2 border-gold-600 bg-gold-950/10 dark:bg-gold-950/20"
    :class="{ 'cursor-pointer': !card && !loading && !pendingAction }"
    @click="handleEmptyClick"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center p-2">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        :leave-to-class="cardLeaveToClass"
        mode="out-in"
        @after-leave="executePendingAction"
      >
        <USkeleton v-if="loading" key="loading" class="aspect-5/7 h-full max-h-full rounded" />
        <img
          v-else-if="card && !pendingAction"
          :key="card.id"
          :src="card.image_uri"
          :alt="card.name"
          class="h-full max-h-full rounded object-contain"
        >
        <div v-else key="empty" class="flex flex-col items-center gap-2">
          <UIcon name="i-lucide-arrow-down-to-line" class="size-10 text-gold-600 dark:text-gold-400" />
          <p class="text-center text-sm font-medium text-gold-600 dark:text-gold-400">
            Tap to draw a card
          </p>
        </div>
      </Transition>
    </div>
    <UProgress v-if="loading" animation="carousel" />
    <div class="flex shrink-0 items-center justify-between gap-2 border-t border-gold-600/40 px-2 py-1.5">
      <div v-if="card" class="flex gap-2">
        <UButton size="sm" :loading="loading" :disabled="loading || !!pendingAction" @click.stop="fetch">
          Fetch
        </UButton>
        <UButton size="sm" variant="outline" :disabled="!!pendingAction" @click.stop="handleCast">
          Cast
        </UButton>
        <UButton size="sm" variant="ghost" :disabled="!!pendingAction" @click.stop="handleClear">
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
