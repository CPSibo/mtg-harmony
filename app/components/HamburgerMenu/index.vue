<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { SlotSize } from '~/types/card'

const settingsStore = useSettingsStore()
const { gridDisplayMode, slotSize } = storeToRefs(settingsStore)

const gridStore = useGridStore()
const onDeckStore = useOnDeckStore()
const historyStore = useHistoryStore()

const toast = useToast()

// ─── Modal / dialog visibility ────────────────────────────────────────────────

const isSettingsOpen = ref(false)
const isHistoryOpen = ref(false)
const isClearConfirmOpen = ref(false)
const isResetConfirmOpen = ref(false)

// Close settings on ESC; history has its own ESC handler inside HistoryModal

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') isSettingsOpen.value = false
})

// ─── Actions ──────────────────────────────────────────────────────────────────

function handleClearGrid() {
  gridStore.clearAll()
  isClearConfirmOpen.value = false
  isSettingsOpen.value = false
  toast.add({ title: 'Grid cleared', color: 'neutral' })
}

function handleResetApp() {
  gridStore.clearAll()
  onDeckStore.clearCard()
  historyStore.clearAll()
  isResetConfirmOpen.value = false
  isSettingsOpen.value = false
  toast.add({ title: 'App reset', color: 'neutral' })
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const DISPLAY_OPTIONS: Array<{ value: 'full' | 'compact', label: string }> = [
  { value: 'full',    label: 'Full' },
  { value: 'compact', label: 'Compact' },
]

const SIZE_OPTIONS: Array<{ value: SlotSize, label: string }> = [
  { value: 'small',  label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large',  label: 'L' },
]
</script>

<template>
  <!-- ── Header bar ─────────────────────────────────────────────────────────── -->
  <div class="flex shrink-0 items-center justify-between gap-1 px-2 py-1.5">
    <div class="flex items-center gap-1 text-xl">
      <UIcon name="i-lucide-flame" :size="20" />
      MTG Discord Helper
    </div>

    <div class="flex gap-1">
      <UButton
        icon="i-lucide-history"
        variant="ghost"
        size="lg"
        aria-label="View history"
        title="View history"
        @click="isHistoryOpen = true"
      />
      <UButton
        icon="i-lucide-settings-2"
        variant="ghost"
        size="lg"
        aria-label="Open settings"
        title="Open settings"
        @click="isSettingsOpen = true"
      />
    </div>
  </div>

  <!-- ── Settings modal ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSettingsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="isSettingsOpen = false" />

        <!-- Panel -->
        <Transition
          enter-active-class="transition duration-150"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          appear
        >
          <div
            v-if="isSettingsOpen"
            class="relative w-full max-w-sm rounded-lg bg-white shadow-xl dark:bg-slate-800"
          >
            <!-- Modal header -->
            <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                Settings
              </h2>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="md"
                aria-label="Close settings"
                @click="isSettingsOpen = false"
              />
            </div>

            <div class="px-5 py-4">
              <!-- ── Grid section ──────────────────────────────────────────── -->
              <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Grid
              </p>

              <!-- Display mode -->
              <div class="mb-3 flex items-center justify-between gap-4">
                <span class="text-sm text-slate-700 dark:text-slate-300">Display</span>
                <div class="flex gap-0.5">
                  <button
                    v-for="opt in DISPLAY_OPTIONS"
                    :key="opt.value"
                    class="rounded px-3 py-1 text-sm font-medium transition-colors"
                    :class="gridDisplayMode === opt.value
                      ? 'bg-gold-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200'"
                    :aria-pressed="gridDisplayMode === opt.value"
                    @click="settingsStore.setDisplayMode(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Card size -->
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm text-slate-700 dark:text-slate-300">Card size</span>
                <div class="flex gap-0.5">
                  <button
                    v-for="opt in SIZE_OPTIONS"
                    :key="opt.value"
                    class="flex size-8 items-center justify-center rounded text-sm font-semibold transition-colors"
                    :class="slotSize === opt.value
                      ? 'bg-gold-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200'"
                    :aria-pressed="slotSize === opt.value"
                    :aria-label="`${opt.value} card size`"
                    @click="settingsStore.setSlotSize(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- ── Actions section ──────────────────────────────────────── -->
              <hr class="my-4 border-slate-200 dark:border-slate-700">

              <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Actions
              </p>

              <div class="-mx-2 flex flex-col">
                <button
                  class="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  @click="isClearConfirmOpen = true"
                >
                  <UIcon name="i-lucide-trash-2" class="size-4 shrink-0" />
                  Clear grid
                </button>
                <button
                  class="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  @click="isResetConfirmOpen = true"
                >
                  <UIcon name="i-lucide-rotate-ccw" class="size-4 shrink-0" />
                  Reset app
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Confirm: clear grid ────────────────────────────────────────────────── -->
  <SharedConfirmDialog
    :open="isClearConfirmOpen"
    title="Clear grid?"
    message="All cards will be removed from the grid. Your On Deck card and history log will not be affected."
    confirm-label="Clear"
    cancel-label="Cancel"
    @confirm="handleClearGrid"
    @cancel="isClearConfirmOpen = false"
    @update:open="isClearConfirmOpen = $event"
  />

  <!-- ── Confirm: reset app ─────────────────────────────────────────────────── -->
  <SharedConfirmDialog
    :open="isResetConfirmOpen"
    title="Reset app?"
    message="The grid, On Deck card, and history log will all be cleared. Your settings will not be affected."
    confirm-label="Reset"
    cancel-label="Cancel"
    @confirm="handleResetApp"
    @cancel="isResetConfirmOpen = false"
    @update:open="isResetConfirmOpen = $event"
  />

  <!-- ── History modal ──────────────────────────────────────────────────────── -->
  <HistoryModal v-model:open="isHistoryOpen" />
</template>
