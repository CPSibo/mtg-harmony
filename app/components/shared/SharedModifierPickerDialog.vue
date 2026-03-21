<script setup lang="ts">
import type { Modifier } from '~/types/card'

const props = defineProps<{
  open: boolean
  cardName: string
  currentModifiers: Modifier[]
}>()

const emit = defineEmits<{
  (e: 'apply', modifiers: Modifier[]): void
  (e: 'cancel'): void
  (e: 'update:open', value: boolean): void
}>()

const MODIFIERS: Array<Omit<Modifier, 'id'>> = [
  // Counters
  { type: '+1/+1',          symbol: 'ms ms-counter-plus' },
  { type: '-1/-1',          symbol: 'ms ms-counter-minus' },
  { type: 'Loyalty',        symbol: 'ms ms-counter-loyalty' },
  { type: 'Charge',         symbol: 'ms ms-counter-charge' },
  { type: 'Lore',           symbol: 'ms ms-counter-lore' },
  { type: 'Poison',         symbol: 'ms ms-counter-skull' },
  { type: 'Shield',         symbol: 'ms ms-counter-shield' },
  // Keyword abilities
  { type: 'Flying',         symbol: 'ms ms-ability-flying' },
  { type: 'Haste',          symbol: 'ms ms-ability-haste' },
  { type: 'Trample',        symbol: 'ms ms-ability-trample' },
  { type: 'Vigilance',      symbol: 'ms ms-ability-vigilance' },
  { type: 'Deathtouch',     symbol: 'ms ms-ability-deathtouch' },
  { type: 'Lifelink',       symbol: 'ms ms-ability-lifelink' },
  { type: 'Hexproof',       symbol: 'ms ms-ability-hexproof' },
  { type: 'Indestructible', symbol: 'ms ms-ability-indestructible' },
  { type: 'First Strike',   symbol: 'ms ms-ability-first-strike' },
  { type: 'Double Strike',  symbol: 'ms ms-ability-double-strike' },
  { type: 'Menace',         symbol: 'ms ms-ability-menace' },
  { type: 'Reach',          symbol: 'ms ms-ability-reach' },
  // Status
  { type: 'Tapped',         symbol: 'ms ms-tap' },
]

// Count per modifier type, keyed by type string
const counts = reactive<Record<string, number>>(
  Object.fromEntries(MODIFIERS.map(m => [m.type, 0]))
)

function initCounts() {
  for (const key of Object.keys(counts)) counts[key] = 0
  for (const mod of props.currentModifiers) {
    if (mod.type in counts) counts[mod.type] = (counts[mod.type] ?? 0) + 1
  }
}

watch(() => props.open, (val) => {
  if (val) initCounts()
})

function increment(type: string) {
  counts[type] = (counts[type] ?? 0) + 1
}

function decrement(type: string) {
  counts[type] = Math.max(0, (counts[type] ?? 0) - 1)
}

function onApply() {
  const newModifiers: Modifier[] = []
  for (const def of MODIFIERS) {
    const count = counts[def.type] ?? 0
    // Preserve existing IDs where possible so store updates are stable
    const existing = props.currentModifiers.filter(m => m.type === def.type)
    for (let i = 0; i < count; i++) {
      newModifiers.push(i < existing.length
        ? existing[i]!
        : { id: randomUUID(), ...def }
      )
    }
  }
  emit('apply', newModifiers)
  emit('update:open', false)
}

function onCancel() {
  emit('cancel')
  emit('update:open', false)
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') onCancel()
})
</script>

<template>
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
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 cursor-pointer bg-black/50" @click="onCancel" />

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
            v-if="open"
            class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
          >
            <h2 class="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              Modifiers — {{ cardName }}
            </h2>

            <div class="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
              <div
                v-for="mod in MODIFIERS"
                :key="mod.type"
                :class="[
                  'flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors',
                  (counts[mod.type] ?? 0) > 0
                    ? 'border-gold-500 bg-gold-50 dark:border-gold-400 dark:bg-gold-900/20'
                    : 'border-slate-200 dark:border-slate-600',
                ]"
              >
                <span :class="mod.symbol" class="text-2xl" />
                <span class="w-full truncate text-xs text-slate-700 dark:text-slate-300">
                  {{ mod.type }}
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="flex size-5 cursor-pointer items-center justify-center rounded-full bg-slate-200 text-xs hover:bg-slate-300 disabled:opacity-30 dark:bg-slate-600 dark:hover:bg-slate-500"
                    :disabled="counts[mod.type] === 0"
                    :title="`Remove ${mod.type}`"
                    @click="decrement(mod.type)"
                  >
                    −
                  </button>
                  <span class="w-4 text-center text-sm font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {{ counts[mod.type] }}
                  </span>
                  <button
                    class="flex size-5 cursor-pointer items-center justify-center rounded-full bg-slate-200 text-xs hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500"
                    :title="`Add ${mod.type}`"
                    @click="increment(mod.type)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="onCancel">
                Cancel
              </UButton>
              <UButton color="primary" @click="onApply">
                Apply
              </UButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
