<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { GridCard, Modifier, SlotSize } from '~/types/card'

const gridStore = useGridStore()
const { pageCards, cards } = storeToRefs(gridStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotsPerPage, slotSize } = storeToRefs(settingsStore)

// ─── Slot sizing & auto-fit ───────────────────────────────────────────────────

// Pixel widths for each named size. Full-mode height follows the 5:7 card aspect
// ratio. Compact mode slots shrink to content (~2 text lines + padding ≈ 48px).
const SLOT_WIDTHS: Record<SlotSize, number> = { small: 80, medium: 120, large: 160 }
const COMPACT_SLOT_HEIGHT = 48
const GAP = 8 // gap-2

// Measure the card-area element only (excludes the controls row at the bottom).
const cardsAreaEl = ref<HTMLElement | null>(null)
const { width: areaWidth, height: areaHeight } = useElementSize(cardsAreaEl)

const slotMinWidth = computed(() => SLOT_WIDTHS[slotSize.value])
const slotMinHeight = computed(() =>
  gridDisplayMode.value === 'compact'
    ? COMPACT_SLOT_HEIGHT
    : Math.round(slotMinWidth.value * 7 / 5)
)

const columns = computed(() =>
  areaWidth.value > 0
    ? Math.max(1, Math.floor((areaWidth.value + GAP) / (slotMinWidth.value + GAP)))
    : 3
)

const rows = computed(() =>
  areaHeight.value > slotMinHeight.value
    ? Math.max(1, Math.floor((areaHeight.value + GAP) / (slotMinHeight.value + GAP)))
    : 3
)

// Push the computed page size into the store so the grid store's pagination
// stays in sync when the container or size setting changes.
watchEffect(() => {
  settingsStore.setSlotsPerPage(columns.value * rows.value)
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${slotMinWidth.value}px, 1fr))`,
}))

// ─── Empty-slot padding ───────────────────────────────────────────────────────

const emptySlots = computed(() =>
  Math.max(0, slotsPerPage.value - pageCards.value.length)
)

// ─── Swipe pagination ─────────────────────────────────────────────────────────

const gridEl = ref<HTMLElement | null>(null)

useSwipe(gridEl, {
  threshold: 50,
  onSwipeEnd(_e, direction) {
    if (direction === 'left') gridStore.nextPage()
    else if (direction === 'right') gridStore.prevPage()
  },
})

// ─── Dialogs ──────────────────────────────────────────────────────────────────

const toast = useToast()

const activeCardId = ref<string | null>(null)
const activeCard = computed<GridCard | undefined>(() =>
  cards.value.find(c => c.id === activeCardId.value)
)

const isRemoveConfirmOpen = ref(false)
const isModifierPickerOpen = ref(false)
const isModifierSplitOpen = ref(false)
const pendingModifiers = ref<Modifier[]>([])

function onRequestRemove(cardId: string) {
  activeCardId.value = cardId
  isRemoveConfirmOpen.value = true
}

function onRequestAddModifier(cardId: string) {
  activeCardId.value = cardId
  isModifierPickerOpen.value = true
}

function handleRemoveConfirmed() {
  if (activeCardId.value) {
    gridStore.removeCard(activeCardId.value)
    toast.add({ title: 'Card removed', color: 'neutral' })
  }
  isRemoveConfirmOpen.value = false
  activeCardId.value = null
}

function handleModifiersApplied(newModifiers: Modifier[]) {
  isModifierPickerOpen.value = false
  if (!activeCard.value) return
  const wasAdded = newModifiers.length > activeCard.value.modifiers.length
  if (wasAdded && activeCard.value.instanceCount > 1) {
    pendingModifiers.value = newModifiers
    isModifierSplitOpen.value = true
  } else {
    gridStore.updateCard(activeCard.value.id, { modifiers: newModifiers })
    toast.add({ title: 'Modifiers updated', color: 'success' })
    activeCardId.value = null
  }
}

function handleApplyModifierToAll() {
  if (activeCard.value) {
    gridStore.updateCard(activeCard.value.id, { modifiers: pendingModifiers.value })
    toast.add({ title: 'Modifiers applied to all', color: 'success' })
  }
  isModifierSplitOpen.value = false
  pendingModifiers.value = []
  activeCardId.value = null
}

function handleSplitModifier() {
  if (!activeCard.value) return
  const originalId = activeCard.value.id
  const originalCount = activeCard.value.instanceCount
  const originalIndex = cards.value.findIndex(c => c.id === originalId)
  const originalModifiers = activeCard.value.modifiers

  gridStore.duplicateCard(originalId)

  const newCard = cards.value[originalIndex + 1]
  if (newCard) {
    gridStore.updateCard(newCard.id, { modifiers: pendingModifiers.value })
  }
  gridStore.updateCard(originalId, {
    instanceCount: originalCount - 1,
    modifiers: originalModifiers,
  })

  toast.add({ title: 'Card split off with modifiers', color: 'success' })
  isModifierSplitOpen.value = false
  pendingModifiers.value = []
  activeCardId.value = null
}

// ─── Size toggle ──────────────────────────────────────────────────────────────

const SIZE_OPTIONS: Array<{ value: SlotSize, label: string }> = [
  { value: 'small',  label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large',  label: 'L' },
]
</script>

<template>
  <div
    ref="gridEl"
    class="flex select-none flex-col gap-2 overflow-hidden touch-pan-y"
  >
    <!-- Cards area: fills remaining height so useElementSize gets a real value -->
    <div ref="cardsAreaEl" class="min-h-0 flex-1 overflow-hidden">
      <div class="grid gap-2" :style="gridStyle">
        <CardGridGridSlot
          v-for="card in pageCards"
          :key="card.id"
          :card="card"
          :display-mode="gridDisplayMode"
          @request-remove="onRequestRemove"
          @request-add-modifier="onRequestAddModifier"
        />
        <CardGridGridSlot
          v-for="i in emptySlots"
          :key="`empty-${i}`"
          :card="null"
          :display-mode="gridDisplayMode"
        />
      </div>
    </div>

    <!-- Controls row: paginator + slot-size toggle -->
    <div class="flex shrink-0 items-center justify-between">
      <CardGridGridPaginator />
    </div>

    <!-- Dialogs (rendered at grid root so they're outside any overflow-hidden subtree) -->
    <SharedConfirmDialog
      :open="isRemoveConfirmOpen"
      title="Remove card?"
      :message="activeCard ? `Remove '${activeCard.name}' from the grid?` : ''"
      confirm-label="Remove"
      cancel-label="Cancel"
      @confirm="handleRemoveConfirmed"
      @cancel="isRemoveConfirmOpen = false"
      @update:open="isRemoveConfirmOpen = $event"
    />

    <SharedModifierPickerDialog
      :open="isModifierPickerOpen"
      :card-name="activeCard?.name ?? ''"
      :current-modifiers="activeCard?.modifiers ?? []"
      @apply="handleModifiersApplied"
      @cancel="isModifierPickerOpen = false"
      @update:open="isModifierPickerOpen = $event"
    />

    <SharedConfirmDialog
      :open="isModifierSplitOpen"
      title="Apply modifiers"
      :message="activeCard ? `'${activeCard.name}' has ${activeCard.instanceCount} instances. Apply to all or split one off?` : ''"
      confirm-label="Apply to all"
      cancel-label="Split one off"
      @confirm="handleApplyModifierToAll"
      @cancel="handleSplitModifier"
      @update:open="isModifierSplitOpen = $event"
    />
  </div>
</template>
