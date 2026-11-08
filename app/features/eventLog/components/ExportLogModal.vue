<template>
  <UModal
    v-model:open="open"
    title="Export log"
    description="Copy or download events from the log"
    :ui="{ body: 'flex flex-col gap-4', footer: 'flex justify-end gap-2' }"
  >
    <template #body>
      <div
        v-for="group in groups"
        :key="group.legend"
        role="group"
        :aria-label="group.legend"
        class="flex flex-col gap-1.5"
      >
        <span class="text-sm font-medium">{{ group.legend }}</span>
        <div class="flex flex-wrap items-center gap-2">
          <UFieldGroup>
            <UButton
              v-for="option in group.options"
              :key="option.value"
              :label="option.label"
              :aria-pressed="group.model.value === option.value"
              :color="
                group.model.value === option.value ? 'primary' : 'neutral'
              "
              :variant="
                group.model.value === option.value ? 'solid' : 'outline'
              "
              @click="group.model.value = option.value"
            />
          </UFieldGroup>
          <UButton
            v-if="group.legend === 'Format'"
            icon="i-lucide-clipboard-copy"
            label="Copy"
            variant="soft"
            :disabled="!entries.length"
            @click="copy"
          />
        </div>
      </div>
      <p class="text-sm text-muted">Matches {{ count }} {{ noun }}</p>
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-download"
        :disabled="!entries.length"
        @click="download"
      >
        Download
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UFieldGroup from '@nuxt/ui/components/FieldGroup.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { useToast } from '@nuxt/ui/composables';
import { computed, ref, type Ref } from 'vue';
import {
  exportEntries,
  selectForExport,
  useEventLogStore,
  type ExportCards,
  type ExportFormat,
  type ExportRange,
} from '..';

const open = defineModel<boolean>('open', { default: false });

const log = useEventLogStore();
const toast = useToast();

const range = ref<ExportRange>('game');
const cards = ref<ExportCards>('cast');
const format = ref<ExportFormat>('text');

interface Group {
  legend: string;
  model: Ref<string>;
  options: { label: string; value: string }[];
}

const groups: Group[] = [
  {
    legend: 'Range',
    model: range,
    options: [
      { label: 'This game', value: 'game' },
      { label: 'Today', value: 'today' },
      { label: 'Everything', value: 'all' },
    ],
  },
  {
    legend: 'Events',
    model: cards,
    options: [
      { label: 'Cards cast', value: 'cast' },
      { label: 'All cards fetched', value: 'fetched' },
      { label: 'All', value: 'all' },
    ],
  },
  {
    legend: 'Format',
    model: format,
    options: [
      { label: 'Plain text', value: 'text' },
      { label: 'CSV', value: 'csv' },
    ],
  },
];

const entries = computed(() =>
  selectForExport(log.entries, {
    range: range.value,
    cards: cards.value,
    gameId: log.gameId,
  }),
);
const content = computed(() => exportEntries(entries.value, format.value));

const count = computed(() => entries.value.length.toLocaleString());
const noun = computed(() => {
  const one = entries.value.length === 1;
  if (cards.value === 'all') return one ? 'event' : 'events';
  return one ? 'card' : 'cards';
});

async function copy() {
  try {
    await navigator.clipboard.writeText(content.value);
    toast.add({ title: 'Copied to clipboard', color: 'success' });
  } catch {
    toast.add({ title: 'Could not copy', color: 'error' });
  }
}

function download() {
  const type = format.value === 'csv' ? 'text/csv' : 'text/plain';
  const url = URL.createObjectURL(new Blob([content.value], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `mtg-harmony-${cards.value}-${range.value}-${new Date()
    .toISOString()
    .slice(0, 10)}.${format.value === 'csv' ? 'csv' : 'txt'}`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>
