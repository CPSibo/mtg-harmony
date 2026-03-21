<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { CopyFormat } from '~/utils/historyExport'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const historyStore = useHistoryStore()
const { entries } = storeToRefs(historyStore)

const toast = useToast()

function close() {
  emit('update:open', false)
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') close()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Writes text to the clipboard. Falls back to `document.execCommand('copy')`
 * for non-HTTPS contexts and older browsers that lack the Clipboard API.
 */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback: create an off-screen textarea, select its content, and use the
  // legacy execCommand to copy. The element is always removed in the finally block.
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(el)
  try {
    el.select()
    document.execCommand('copy')
  } finally {
    document.body.removeChild(el)
  }
}

async function copyInFormat(format: CopyFormat): Promise<void> {
  const text = formatEntries(entries.value, format)
  try {
    await copyToClipboard(text)
    toast.add({ title: 'Copied to clipboard', color: 'neutral' })
  } catch {
    toast.add({ title: 'Copy failed', color: 'error' })
  }
}

const copyMenuItems = [
  {
    label: 'Raw list',
    icon: 'i-lucide-align-left',
    onSelect: () => copyInFormat('raw'),
  },
  {
    label: 'Markdown unordered',
    icon: 'i-lucide-list',
    onSelect: () => copyInFormat('md-unordered'),
  },
  {
    label: 'Markdown ordered',
    icon: 'i-lucide-list-ordered',
    onSelect: () => copyInFormat('md-ordered'),
  },
  {
    label: 'Numbered list',
    icon: 'i-lucide-hash',
    onSelect: () => copyInFormat('numbered'),
  },
]
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900"
      >
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
            History
          </h2>
          <div class="flex items-center gap-1">
            <UDropdownMenu
              v-if="entries.length"
              :items="copyMenuItems"
              :ui="{ content: 'z-[60]' }"
            >
              <UButton
                icon="i-lucide-copy"
                variant="ghost"
                size="md"
                aria-label="Copy history"
                title="Copy history"
              />
            </UDropdownMenu>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="md"
              aria-label="Close history"
              title="Close history"
              @click="close"
            />
          </div>
        </div>

        <!-- Scrollable entry list -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <p
            v-if="!entries.length"
            class="py-16 text-center text-sm text-slate-400 dark:text-slate-500"
          >
            No cards fetched yet.
          </p>

          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="entry in entries"
              :key="entry.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <!-- Timestamp -->
              <span class="w-28 shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {{ formatDate(entry.fetchedAt) }}
              </span>

              <!-- Card name as Scryfall link -->
              <a
                :href="entry.scryfall_uri"
                target="_blank"
                rel="noopener noreferrer"
                :title="`Open ${entry.cardName} in Scryfall`"
                class="flex-1 truncate text-sm font-medium text-gold-700 hover:underline dark:text-gold-400"
              >
                {{ entry.cardName }}
              </a>

              <!-- Cast badge -->
              <span
                v-if="entry.wasCast"
                class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                Cast
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
