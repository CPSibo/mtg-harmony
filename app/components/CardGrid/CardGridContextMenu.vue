<script setup lang="ts">
import type { GridCard } from '~/types/card'

const props = defineProps<{
  card: GridCard
  anchorEl: HTMLElement
}>()

const emit = defineEmits<{
  close: []
  openInfo: []
  remove: []
  duplicate: []
  addCount: []
  addModifier: []
}>()

const menuEl = ref<HTMLElement | null>(null)

const menuStyle = ref<Record<string, string>>({})

onMounted(() => {
  const rect = props.anchorEl.getBoundingClientRect()
  const menuWidth = 160
  const menuHeight = 240 // estimated

  const slotCenterX = rect.left + rect.width / 2
  const openRight = slotCenterX < window.innerWidth / 2

  const top = rect.top + rect.bottom > window.innerHeight
    ? Math.max(0, rect.bottom - menuHeight)
    : rect.top

  if (openRight) {
    menuStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${rect.right + 4}px`,
      zIndex: '50',
    }
  } else {
    menuStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${rect.left - menuWidth - 4}px`,
      zIndex: '50',
    }
  }

  menuEl.value?.focus()
})

onClickOutside(menuEl, () => emit('close'))

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
})

const items = [
  { label: 'Open info', icon: 'i-lucide-external-link', action: () => emit('openInfo'), class: '' },
  { label: 'Duplicate', icon: 'i-lucide-copy', action: () => emit('duplicate'), class: '' },
  { label: 'Add count', icon: 'i-lucide-hash', action: () => emit('addCount'), class: '' },
  { label: 'Add modifier', icon: 'i-lucide-tag', action: () => emit('addModifier'), class: '' },
  { label: 'Remove', icon: 'i-lucide-trash-2', action: () => emit('remove'), class: 'text-red-500' },
]
</script>

<template>
  <div
    ref="menuEl"
    role="menu"
    tabindex="-1"
    :style="menuStyle"
    class="min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-800"
  >
    <button
      v-for="item in items"
      :key="item.label"
      role="menuitem"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
      :class="item.class"
      @click="item.action()"
    >
      <UIcon :name="item.icon" class="size-4 shrink-0" />
      {{ item.label }}
    </button>
  </div>
</template>
