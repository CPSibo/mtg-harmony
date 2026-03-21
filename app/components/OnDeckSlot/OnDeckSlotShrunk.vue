<script setup lang="ts">
import { storeToRefs } from 'pinia'

const onDeckStore = useOnDeckStore()
const { card } = storeToRefs(onDeckStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode } = storeToRefs(settingsStore)

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

// ─── Deferred cast / clear ────────────────────────────────────────────────────

/** Set before calling the store so the card content exit animation plays first. */
const pendingAction = ref<'cast' | 'clear' | null>(null)

/** Exit transform — upward for cast, shrink for clear. */
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

/** Called by @after-leave — by this point the card content has fully exited. */
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
    :class="[
      'relative flex flex-col overflow-hidden rounded-md border-2 border-gold-600 bg-gold-950/10 dark:bg-gold-950/20',
      gridDisplayMode === 'full' ? 'aspect-5/7' : 'min-h-16',
      !card && !loading && !pendingAction ? 'cursor-pointer' : '',
    ]"
    @click="handleEmptyClick"
  >
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-1.5"
      :class="{ 'items-start justify-start': card || loading || !!pendingAction }"
    >
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
        <div v-if="loading" key="loading" class="flex w-full flex-col gap-1">
          <USkeleton class="h-4 w-3/4 rounded" />
          <USkeleton class="h-4 w-1/2 rounded" />
        </div>
        <div v-else-if="card && !pendingAction" :key="card.id" class="flex w-full flex-col items-start">
          <p class="truncate text-sm font-medium leading-tight">{{ card.name }}</p>
          <span class="mt-0.5 flex gap-0.5 [&>i:first-child]:ms-0">
            <i v-for="sym in manaSymbols" :key="sym" :class="[sym, 'text-xs']" />
          </span>
          <div class="mt-1.5 flex flex-col items-start gap-0.5">
            <UButton size="xs" :loading="loading" :disabled="loading || !!pendingAction" @click.stop="fetch">
              Fetch
            </UButton>
            <UButton size="xs" variant="outline" :disabled="!!pendingAction" @click.stop="handleCast">
              Cast
            </UButton>
            <UButton size="xs" variant="ghost" :disabled="!!pendingAction" @click.stop="handleClear">
              Clear
            </UButton>
          </div>
        </div>
        <div v-else key="empty" class="flex flex-col items-center gap-1.5">
          <UIcon name="i-lucide-arrow-down-to-line" class="size-6 text-gold-600 dark:text-gold-400" />
          <p class="text-center text-xs font-medium text-gold-600 dark:text-gold-400">
            Tap to draw a card
          </p>
        </div>
      </Transition>
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
