<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { GridCard, Modifier } from '~/types/card'
import type { SlotSize } from '~/types/AppSettings' 

const gridStore = useGridStore()
const { pageCards, cards } = storeToRefs(gridStore)

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotsPerPage, slotSize, onDeckExpanded } = storeToRefs(settingsStore)

// ─── Slot sizing & auto-fit ───────────────────────────────────────────────────

// Pixel widths for each named size. Full-mode height follows the 5:7 card aspect
// ratio. Compact mode slots shrink to content (~2 text lines + padding ≈ 64px).
const SLOT_WIDTHS: Record<SlotSize, number> = { small: 100, medium: 150, large: 200 }
const COMPACT_SLOT_HEIGHT = 64
const GAP = 8 // gap-2

// Measure the card-area element only (excludes the controls row at the bottom).
const cardsAreaEl = ref<HTMLElement | null>(null)

// Seed the initial width from the window so the column count is correct on the
// very first render, before ResizeObserver fires. Without this, areaWidth starts
// at 0, columns fall back to 3, and the grid immediately reflows when the first
// measurement arrives — causing a CLS of ~0.27 on mobile viewports.
// The cards area is inset by the 8 px padding on each side of the CardGrid
// container (p-2 = 0.5 rem = 8 px), so subtract 16 px from the window width.
const initialAreaWidth = import.meta.client ? window.innerWidth - 16 : 400
const { width: areaWidth, height: areaHeight } = useElementSize(cardsAreaEl, { width: initialAreaWidth, height: 0 })

const slotMinWidth = computed(() => SLOT_WIDTHS[slotSize.value])

const columns = computed(() =>
  areaWidth.value > 0
    ? Math.max(1, Math.floor((areaWidth.value + GAP) / (slotMinWidth.value + GAP)))
    : 3
)

// Actual column width after CSS distributes the 1fr columns across the area.
// Deriving row height from this (rather than from slotMinWidth) ensures
// gridAutoRows exactly matches what aspect-5/7 slots produce, so there is no
// height mismatch that would collapse or expand the inter-row gap.
const columnWidth = computed(() =>
  columns.value > 0 && areaWidth.value > 0
    ? (areaWidth.value - (columns.value - 1) * GAP) / columns.value
    : slotMinWidth.value
)

const slotHeight = computed(() =>
  gridDisplayMode.value === 'compact'
    ? COMPACT_SLOT_HEIGHT
    : Math.round(columnWidth.value * 7 / 5)
)

const rows = computed(() =>
  areaHeight.value > slotHeight.value
    ? Math.max(1, Math.floor((areaHeight.value + GAP) / (slotHeight.value + GAP)))
    : 3
)

// ─── OnDeck slot span ─────────────────────────────────────────────────────────

const slots = useSlots()
const hasOnDeck = computed(() => !!slots['on-deck'])

// When expanded the OnDeck cell spans 2 columns × 2 rows; when shrunk, 1 × 1.
// Column span is clamped to the available column count so we never ask the grid
// for more columns than actually exist.
const onDeckColSpan = computed(() =>
  hasOnDeck.value ? (onDeckExpanded.value ? Math.min(2, columns.value) : 1) : 0
)
const onDeckRowSpan = computed(() =>
  hasOnDeck.value ? (onDeckExpanded.value ? 2 : 1) : 0
)

// The pixel width of the OnDeck label, matched to the OnDeck slot's column span.
const onDeckLabelWidth = computed(() => {
  if (!hasOnDeck.value || areaWidth.value === 0) return 0
  return onDeckColSpan.value * columnWidth.value + (onDeckColSpan.value - 1) * GAP
})

// Hide the Board label when the OnDeck slot fills the entire first row.
const showBoardLabel = computed(() =>
  hasOnDeck.value && onDeckColSpan.value < columns.value
)

// Push the computed page size into the store so grid pagination stays in sync
// when the container, size setting, or OnDeck span changes.
// OnDeck cells are subtracted from the total so slotsPerPage reflects only
// the slots available for cast cards.
watchEffect(() => {
  const total = columns.value * rows.value
  const onDeckCells = hasOnDeck.value ? onDeckColSpan.value * onDeckRowSpan.value : 0
  settingsStore.setSlotsPerPage(Math.max(1, total - onDeckCells))
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${slotMinWidth.value}px, 1fr))`,
  // Full mode: fix row height to the card aspect ratio so a loading image's
  // natural size cannot push rows taller and shift the grid.
  // Compact mode: allow growth so the OnDeck shrunk slot's button stack can
  // expand beyond the minimum row height.
  gridAutoRows: gridDisplayMode.value === 'full'
    ? `${slotHeight.value}px`
    : `minmax(${slotHeight.value}px, auto)`,
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

// ─── Grid card leave animation ────────────────────────────────────────────────

/**
 * Positions the leaving card absolutely at its current grid coordinates so
 * it can fade out in place while the remaining cards FLIP to their new
 * positions at the same time (rather than snapping after the leave ends).
 * The grid container has `position: relative` so offsetLeft/offsetTop are
 * relative to it, matching the absolute positioning origin.
 */
function onGridCardLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  htmlEl.style.left = `${htmlEl.offsetLeft}px`
  htmlEl.style.top = `${htmlEl.offsetTop}px`
  htmlEl.style.width = `${htmlEl.offsetWidth}px`
  htmlEl.style.height = `${htmlEl.offsetHeight}px`
  htmlEl.style.position = 'absolute'
  requestAnimationFrame(() => {
    htmlEl.style.opacity = '0'
    htmlEl.style.transform = 'scale(0.85)'
    htmlEl.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in'
    htmlEl.addEventListener('transitionend', done, { once: true })
  })
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
  <div
    ref="gridEl"
    class="flex select-none flex-col gap-2 overflow-hidden touch-pan-y p-2"
  >
    <!-- Section labels + paginator in a single stable-height header row -->
    <div v-if="hasOnDeck" class="flex shrink-0 items-center gap-2">
      <span
        class="shrink-0 text-xs font-semibold uppercase tracking-wider text-gold-500"
        :style="{ width: `${onDeckLabelWidth}px` }"
      >
        On Deck
      </span>
      <span
        v-if="showBoardLabel"
        class="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300"
      >
        Board
      </span>
      <div class="flex-1" />
      <CardGridGridPaginator />
    </div>

    <!-- Cards area: fills remaining height so useElementSize gets a real value -->
    <div ref="cardsAreaEl" class="min-h-0 flex-1 overflow-hidden">
      <!--
        TransitionGroup renders as the grid container.
        Enter: cards pop in with a fade + scale.
        Leave: JS hook positions the leaving card absolutely so remaining
               cards FLIP-animate to their new positions simultaneously.
        Move:  remaining cards slide smoothly via FLIP transform.
      -->
      <TransitionGroup
        tag="div"
        class="relative grid gap-2"
        :style="gridStyle"
        enter-active-class="transition-[opacity,transform] duration-200 ease-out"
        enter-from-class="opacity-0 scale-90"
        enter-to-class="opacity-100 scale-100"
        move-class="transition-transform duration-200 ease-out"
        @leave="onGridCardLeave"
      >
        <!-- OnDeck slot: sits inline at the top-left of the grid -->
        <div
          v-if="hasOnDeck"
          key="ondeck"
          class="h-full"
          :style="{
            gridColumn: `span ${onDeckColSpan}`,
            gridRow: `span ${onDeckRowSpan}`,
          }"
        >
          <slot name="on-deck" />
        </div>
        <CardGridGridSlot
          v-for="card in pageCards"
          :key="card.id"
          :card="card"
          :display-mode="gridDisplayMode"
          @request-remove="onRequestRemove"
          @request-add-modifier="onRequestAddModifier"
        />
      </TransitionGroup>
      <CardGridGridSlot
        v-for="i in emptySlots"
        :key="`empty-${i}`"
        :card="null"
        :display-mode="gridDisplayMode"
      />
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
