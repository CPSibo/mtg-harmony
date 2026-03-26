<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()
const { onDeckExpanded, gridDisplayMode } = storeToRefs(settingsStore)

const { loading, fetch } = useScryfall()

// ─── Deferred cast / clear ────────────────────────────────────────────────────

/** Set before the store action so the card exit animation plays first. */
const pendingAction = ref<'cast' | 'clear' | null>(null)

/** Cast exits upward; clear shrinks away. */
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

/** Called by @after-leave — card has fully exited; now commit the store action. */
function executePendingAction() {
  if (pendingAction.value === 'cast') onDeckStore.castCard()
  else if (pendingAction.value === 'clear') onDeckStore.clearCard()
  pendingAction.value = null
}

function handleEmptyClick() {
  if (!card.value && !loading.value && !pendingAction.value) fetch()
}

// ─── Zoom overlay ─────────────────────────────────────────────────────────────

const isZoomed = ref(false)

function handleZoom() {
  isZoomed.value = true
  history.pushState({ zoom: true }, '')
}

function closeZoom() {
  if (!isZoomed.value) return
  isZoomed.value = false
  // Clean up the history entry we pushed on open, but only if it's still
  // there (i.e. the user closed via click/ESC rather than a back gesture).
  if (history.state?.zoom) {
    history.back()
  }
}

// Back gesture (e.g. Android swipe-from-edge) pops the state we pushed.
useEventListener(window, 'popstate', () => {
  if (isZoomed.value) isZoomed.value = false
})

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeZoom()
})

onUnmounted(() => {
  // Clean up any dangling history entry if the component unmounts while zoomed.
  if (isZoomed.value && history.state?.zoom) {
    history.back()
  }
})
</script>

<template>
  <!-- ── Expanded ────────────────────────────────────────────────────────────── -->
  <!-- Image fills the 2×2 span; action buttons sit in a row along the footer. -->
  <div
    v-if="onDeckExpanded"
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
          loading="lazy"
          class="h-full max-h-full cursor-zoom-in rounded object-contain"
          @click.stop="handleZoom"
        >
        <div v-else key="empty" class="flex flex-col items-center gap-2">
          <UIcon name="i-lucide-rotate-cw" class="size-10 text-gold-600 dark:text-gold-400" />
          <p class="text-center text-sm font-medium text-gold-600 dark:text-gold-400">
            Tap to fetch a random card
          </p>
        </div>
      </Transition>
    </div>
    <UProgress v-if="loading" animation="carousel" />
    <div class="flex shrink-0 items-center gap-2 border-t border-gold-600/40 px-2 py-1.5">
      <template v-if="card">
        <UButton size="sm" :loading="loading" color="secondary" icon="i-lucide-rotate-cw" :disabled="loading || !!pendingAction" @click.stop="fetch">
          Fetch
        </UButton>
        <UButton size="sm" icon="i-lucide-arrow-right-from-line" :disabled="!!pendingAction" @click.stop="handleCast">
          Cast
        </UButton>
        <UButton size="sm" color="error" icon="i-lucide-x" :disabled="!!pendingAction" @click.stop="handleClear">
          Clear
        </UButton>
      </template>
      <div class="flex-1" />
      <UButton
        icon="i-lucide-minimize-2"
        color="neutral"
        size="sm"
        aria-label="Shrink"
        title="Shrink"
        @click.stop="settingsStore.toggleOnDeckExpanded()"
      />
    </div>
  </div>

  <!-- ── Shrunk ──────────────────────────────────────────────────────────────── -->
  <!-- Card image fills the 1×1 slot, fading to transparent at the midpoint so  -->
  <!-- the action buttons can reflow into a column along the bottom.             -->
  <div
    v-else
    class="relative overflow-hidden rounded-md border-2 border-gold-600 bg-gold-950/10 dark:bg-gold-950/20"
    :class="[
      gridDisplayMode === 'full' ? 'aspect-5/7' : 'min-h-16',
      !card && !loading && !pendingAction ? 'cursor-pointer' : '',
    ]"
    @click="handleEmptyClick"
  >
    <!-- Image / loading skeleton / empty state fills the entire slot -->
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
      <USkeleton v-if="loading" key="loading" class="absolute inset-0" />
      <img
        v-else-if="card && !pendingAction"
        :key="card.id"
        :src="card.image_uri"
        :alt="card.name"
        loading="lazy"
        class="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
        @click.stop="handleZoom"
      >
      <div v-else key="empty" class="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <UIcon name="i-lucide-rotate-cw" class="size-6 text-gold-600 dark:text-gold-400" />
        <p class="text-center text-xs font-medium text-gold-600 dark:text-gold-400">
          Tap to fetch a random card
        </p>
      </div>
    </Transition>

    <!-- Gradient: fades the card image to transparent from the midpoint down,  -->
    <!-- providing a backdrop for the buttons without a hard seam.              -->
    <div
      v-if="card || loading"
      class="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-20% to-90% to-black"
    />

    <!-- Action buttons in a full-width column at the bottom -->
    <div class="absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-1">
      <template v-if="card">
        <UButton
          class="w-full justify-center"
          size="xs"
          color="secondary"
          icon="i-lucide-rotate-cw"
          :loading="loading"
          :disabled="loading || !!pendingAction"
          @click.stop="fetch"
        >
          Next
        </UButton>
        <UButton
          class="w-full justify-center"
          size="xs"
          icon="i-lucide-arrow-right-from-line"
          :disabled="!!pendingAction"
          @click.stop="handleCast"
        >
          Cast
        </UButton>
        <UButton
          class="w-full justify-center text-black"
          size="xs"
          color="error"
          icon="i-lucide-x"
          :disabled="!!pendingAction"
          @click.stop="handleClear"
        >
          Clear
        </UButton>
      </template>
      <UButton
        class="w-full justify-center"
        size="xs"
        color="neutral"
        icon="i-lucide-maximize-2"
        @click.stop="settingsStore.toggleOnDeckExpanded()"
      >
        Expand
      </UButton>
    </div>
  </div>

  <!-- Zoom overlay (teleported to body to escape overflow/stacking) -->
  <Teleport to="body">
    <div
      v-if="isZoomed && card"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click="closeZoom"
    >
      <img
        :src="card.image_uri"
        :alt="card.name"
        class="rounded-lg object-contain shadow-2xl"
        style="max-height: min(80svh, 800px); width: auto;"
      >
    </div>
  </Teleport>
</template>
