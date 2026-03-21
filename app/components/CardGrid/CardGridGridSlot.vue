<script setup lang="ts">
import type { GridCard } from '~/types/card'

const props = defineProps<{
  card: GridCard | null
  displayMode: 'full' | 'compact'
}>()

const emit = defineEmits<{
  (e: 'requestRemove', cardId: string): void
  (e: 'requestAddModifier', cardId: string): void
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

// Long press
onLongPress(slotEl, openContextMenu, { delay: 500 })

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

function removeModifier(modId: string) {
  if (!props.card) return
  gridStore.updateCard(props.card.id, {
    modifiers: props.card.modifiers.filter(m => m.id !== modId),
  })
}
</script>

<template>
  <!-- Empty slot -->
  <div
    v-if="!card"
    class="aspect-5/7 rounded-md border-2 border-dashed border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
  />

  <!-- Filled slot — count editing overlay -->
  <div
    v-else-if="isCountEditing"
    class="relative aspect-5/7 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
  >
    <div
      ref="countEditorEl"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-slate-900/85"
    >
      <div class="flex items-center gap-2">
        <button
          class="flex size-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          @click="localCount = Math.max(1, localCount - 1)"
        >
          -
        </button>
        <input
          v-model.number="localCount"
          type="number"
          min="1"
          class="w-14 rounded border-b border-white bg-transparent text-center text-lg text-white outline-none"
          @keydown.enter="commitCount"
          @keydown.escape="cancelCount"
        />
        <button
          class="flex size-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          @click="localCount++"
        >
          +
        </button>
      </div>
      <button class="text-xs text-white underline" @click="commitCount">
        Done
      </button>
    </div>
  </div>

  <!-- Filled slot — normal view -->
  <div
    v-else
    ref="slotEl"
    class="relative aspect-5/7 cursor-pointer overflow-hidden rounded-md border border-slate-200 transition-transform duration-75 active:scale-95 dark:border-slate-700"
    @contextmenu.prevent="openContextMenu"
  >
    <!-- Full mode -->
    <template v-if="displayMode === 'full'">
      <img
        :src="card.image_uri"
        :alt="card.name"
        class="h-full w-full object-contain"
      />
      <span class="absolute bottom-5 left-1 rounded bg-black/60 px-1 text-xs text-white">
        ×{{ card.instanceCount }}
      </span>
      <div class="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
        <button
          v-for="mod in card.modifiers"
          :key="mod.id"
          class="group relative"
          @click.stop="removeModifier(mod.id)"
        >
          <span :class="mod.symbol" class="text-base" />
          <span class="absolute -right-1 -top-1 hidden rounded-full bg-red-500 px-0.5 text-[8px] text-white group-hover:block group-focus:block">×</span>
        </button>
      </div>
    </template>

    <!-- Compact mode -->
    <template v-else>
      <div class="flex h-full flex-col px-1 pt-1">
        <p class="truncate text-sm font-medium">{{ card.name }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">×{{ card.instanceCount }}</p>
        <div class="mt-0.5 flex flex-wrap gap-0.5">
          <button
            v-for="mod in card.modifiers"
            :key="mod.id"
            class="group relative"
            @click.stop="removeModifier(mod.id)"
          >
            <span :class="mod.symbol" class="text-base" />
            <span class="absolute -right-1 -top-1 hidden rounded-full bg-red-500 px-0.5 text-[8px] text-white group-hover:block group-focus:block">×</span>
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
        @open-info="handleOpenInfo"
        @remove="handleRemoveRequest"
        @duplicate="handleDuplicate"
        @add-count="handleAddCount"
        @add-modifier="handleAddModifier"
      />
    </Teleport>
  </div>
</template>
