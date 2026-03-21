<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { GridCard, Modifier } from '~/types/card'

const gridStore = useGridStore()
const { pageCards, cards } = storeToRefs(gridStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotsPerPage } = storeToRefs(settingsStore)

const emptySlots = computed(() =>
  Math.max(0, slotsPerPage.value - pageCards.value.length)
)

const gridEl = ref<HTMLElement | null>(null)

useSwipe(gridEl, {
  threshold: 50,
  onSwipeEnd(_e, direction) {
    if (direction === 'left') gridStore.nextPage()
    else if (direction === 'right') gridStore.prevPage()
  },
})

const toast = useToast()

// Active card for dialogs
const activeCardId = ref<string | null>(null)
const activeCard = computed<GridCard | undefined>(() =>
  cards.value.find(c => c.id === activeCardId.value)
)

// Dialog visibility
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
</script>

<template>
  <div ref="gridEl" class="flex flex-col gap-2 select-none touch-pan-y overflow-hidden">
    <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))">
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
    <CardGridGridPaginator />

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
      title="Apply modifier"
      :message="activeCard ? `'${activeCard.name}' has ${activeCard.instanceCount} instances. Apply to all or split one off?` : ''"
      confirm-label="Apply to all"
      cancel-label="Split one off"
      @confirm="handleApplyModifierToAll"
      @cancel="handleSplitModifier"
      @update:open="isModifierSplitOpen = $event"
    />
  </div>
</template>
