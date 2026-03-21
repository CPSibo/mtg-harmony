<script setup lang="ts">
import type { Modifier } from '~/types/card'

const props = defineProps<{
  open: boolean
  cardName: string
}>()

const emit = defineEmits<{
  (e: 'select', modifier: Modifier): void
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

function onSelect(mod: Omit<Modifier, 'id'>) {
  emit('select', { id: crypto.randomUUID(), ...mod })
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
        <div class="absolute inset-0 bg-black/50" @click="onCancel" />

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
              Add modifier to "{{ cardName }}"
            </h2>

            <div class="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
              <button
                v-for="mod in MODIFIERS"
                :key="mod.type"
                class="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-slate-200 p-2 text-center hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                @click="onSelect(mod)"
              >
                <span :class="mod.symbol" class="text-2xl" />
                <span class="w-full truncate text-xs text-slate-700 dark:text-slate-300">
                  {{ mod.type }}
                </span>
              </button>
            </div>

            <div class="flex justify-end">
              <UButton variant="ghost" @click="onCancel">
                Cancel
              </UButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
