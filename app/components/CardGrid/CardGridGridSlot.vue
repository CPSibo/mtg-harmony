<script setup lang="ts">
import type { GridCard } from '~/types/card'

const props = defineProps<{
  card: GridCard | null
  displayMode: 'full' | 'compact'
}>()

const emit = defineEmits<{
  requestRemove: [cardId: string]
  requestAddModifier: [cardId: string]
}>()

const gridStore = useGridStore()
const toast = useToast()

// Element refs
const slotEl = ref<HTMLElement | null>(null)
const countEditorEl = ref<HTMLElement | null>(null)

// Context menu
const isContextMenuOpen = ref(false)

function openContextMenu() {
  if (!props.card || isContextMenuOpen.value) return
  isContextMenuOpen.value = true
}

// Tap / untap
let didLongPress = false

onLongPress(slotEl, () => {
  didLongPress = true
  openContextMenu()
}, { delay: 500 })

function handleSlotClick() {
  if (didLongPress) {
    didLongPress = false
    return
  }
  if (!props.card) return
  gridStore.toggleTapped(props.card.id)
}

// Count editing
const isCountEditing = ref(false)
const localCount = ref(1)

onClickOutside(countEditorEl, commitCount)

function startCountEdit() {
  localCount.value = props.card!.instanceCount
  isCountEditing.value = true
  nextTick(() => {
    countEditorEl.value?.querySelector('input')?.select()
  })
}

function commitCount() {
  if (!props.card || !isCountEditing.value) return
  const raw = localCount.value
  const safe = Number.isFinite(raw) ? raw : 1
  gridStore.updateCard(props.card.id, { instanceCount: Math.max(1, Math.round(safe)) })
  isCountEditing.value = false
}

function cancelCount() {
  isCountEditing.value = false
}

// Zoom
const isZoomed = ref(false)

function handleZoom() {
  isContextMenuOpen.value = false
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
  // If this slot is removed while zoomed (e.g. pagination), clean up the
  // history entry so the user doesn't get a dangling back-navigation.
  if (isZoomed.value && history.state?.zoom) {
    history.back()
  }
})

// Context menu action handlers
function handleOpenInfo() {
  isContextMenuOpen.value = false
  window.open(props.card!.scryfall_uri, '_blank', 'noopener,noreferrer')
}

function handleRemoveRequest() {
  isContextMenuOpen.value = false
  emit('requestRemove', props.card!.id)
}

function handleDuplicate() {
  isContextMenuOpen.value = false
  gridStore.duplicateCard(props.card!.id)
  toast.add({ title: 'Card duplicated', color: 'success' })
}

function handleAddCount() {
  isContextMenuOpen.value = false
  startCountEdit()
}

function handleAddModifier() {
  isContextMenuOpen.value = false
  emit('requestAddModifier', props.card!.id)
}

// Modifiers grouped by type so duplicates (e.g. three +1/+1 counters) are shown as one chip
const groupedModifiers = computed(() => {
  if (!props.card) return []
  const groups = new Map<string, { type: string, symbol: string, count: number }>()
  for (const mod of props.card.modifiers) {
    const g = groups.get(mod.type)
    if (g) g.count++
    else groups.set(mod.type, { type: mod.type, symbol: mod.symbol, count: 1 })
  }
  return [...groups.values()]
})
</script>

<template>
  <!-- Empty slot -->
  <div
    v-if="!card"
    :class="[
      'rounded-md border-2 border-dashed border-slate-400 bg-slate-100 dark:border-slate-800 dark:bg-slate-900',
      displayMode === 'full' ? 'aspect-5/7' : 'min-h-16',
    ]"
  />

  <!-- Filled slot — count editing overlay -->
  <div
    v-else-if="isCountEditing"
    :class="[
      'relative overflow-hidden rounded-md border border-slate-200 dark:border-slate-700',
      displayMode === 'full' ? 'aspect-5/7' : 'min-h-24',
    ]"
  >
    <div
      ref="countEditorEl"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-slate-900/85"
    >
      <div class="flex items-center gap-2">
        <button
          class="flex size-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          @click="localCount = Math.max(1, localCount - 1)"
        >
          -
        </button>
        <input
          v-model.number="localCount"
          type="number"
          min="1"
          class="w-16 rounded border-b border-white bg-transparent text-center text-xl text-white outline-none"
          @keydown.enter="commitCount"
          @keydown.escape="cancelCount"
        >
        <button
          class="flex size-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          @click="localCount++"
        >
          +
        </button>
      </div>
      <button class="text-sm text-white underline" @click="commitCount">
        Done
      </button>
    </div>
  </div>

  <!-- Filled slot — normal view -->
  <div
    v-else
    ref="slotEl"
    :class="[
      'relative rounded-md border border-slate-200 transition-transform duration-75 active:scale-95 dark:border-slate-700',
      displayMode === 'full' ? 'aspect-5/7 overflow-hidden' : '',
      displayMode === 'compact' && card.tapped ? 'opacity-60' : '',
    ]"
    @contextmenu.prevent="openContextMenu"
    @click="handleSlotClick"
  >
    <!-- Full mode -->
    <template v-if="displayMode === 'full'">
      <img
        :src="card.image_uri"
        :alt="card.name"
        class="h-full w-full object-contain transition-[transform] duration-200"
        :class="{ 'rotate-90 scale-[0.714]': card.tapped }"
      >
      <span class="absolute bottom-5 left-1 rounded bg-black/60 px-1 text-sm text-white">
        ×{{ card.instanceCount }}
      </span>
      <div class="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
        <button
          v-for="group in groupedModifiers"
          :key="group.type"
          class="flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-white hover:bg-slate-900"
          :title="group.type"
          @click.stop="emit('requestAddModifier', card!.id)"
        >
          <span :class="group.symbol" class="text-xs" />
          <span v-if="group.count > 1" class="text-xs font-medium leading-none">×{{ group.count }}</span>
        </button>
      </div>
    </template>

    <!-- Compact mode -->
    <template v-else>
      <div class="flex flex-col px-3 py-2">
        <div class="flex items-center gap-1.5">
          <i v-if="card.tapped" class="ms ms-tap ms-2x text-red-700 dark:text-red-500" />
          <p class="truncate text-base font-medium leading-tight">{{ card.name }}</p>
        </div>
        <p class="text-sm leading-tight text-slate-500 dark:text-slate-400">×{{ card.instanceCount }}</p>
        <div v-if="groupedModifiers.length" class="mt-1 flex flex-wrap gap-0.5">
          <button
            v-for="group in groupedModifiers"
            :key="group.type"
            class="flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-white hover:bg-slate-900"
            :title="group.type"
            @click.stop="emit('requestAddModifier', card!.id)"
          >
            <span :class="group.symbol" class="text-xs" />
            <span v-if="group.count > 1" class="text-xs font-medium leading-none">×{{ group.count }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Context menu (teleported to body to escape overflow/stacking) -->
    <Teleport to="body">
      <CardGridContextMenu
        v-if="isContextMenuOpen && card"
        :card="card"
        :anchor-el="slotEl!"
        @close="isContextMenuOpen = false"
        @zoom="handleZoom"
        @open-info="handleOpenInfo"
        @remove="handleRemoveRequest"
        @duplicate="handleDuplicate"
        @add-count="handleAddCount"
        @add-modifier="handleAddModifier"
      />
    </Teleport>

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
  </div>
</template>
