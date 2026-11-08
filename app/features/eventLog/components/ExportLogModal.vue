<template>
  <UModal
    v-model:open="open"
    title="Export log"
    description="Copy or download the cards from the event log"
    :ui="{ body: 'flex flex-col gap-4', footer: 'flex justify-end gap-2' }"
  >
    <template #body>
      <URadioGroup
        v-model="range"
        legend="Range"
        orientation="horizontal"
        :items="[
          { label: 'This game', value: 'game' },
          { label: 'Today', value: 'today' },
          { label: 'Everything', value: 'all' },
        ]"
      />
      <URadioGroup
        v-model="cards"
        legend="Cards"
        orientation="horizontal"
        :items="[
          { label: 'Cards cast', value: 'cast' },
          { label: 'All cards fetched', value: 'fetched' },
        ]"
      />
      <URadioGroup
        v-model="format"
        legend="Format"
        orientation="horizontal"
        :items="[
          { label: 'Plain text', value: 'text' },
          { label: 'CSV', value: 'csv' },
        ]"
      />
      <p class="text-sm text-muted">
        {{ entries.length }} {{ entries.length === 1 ? 'card' : 'cards' }}
      </p>
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-clipboard-copy"
        variant="soft"
        :disabled="!entries.length"
        @click="copy"
      >
        Copy
      </UButton>
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
import UModal from '@nuxt/ui/components/Modal.vue';
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue';
import { useToast } from '@nuxt/ui/composables';
import { computed, ref } from 'vue';
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

const entries = computed(() =>
  selectForExport(log.entries, {
    range: range.value,
    cards: cards.value,
    gameId: log.gameId,
  }),
);
const content = computed(() => exportEntries(entries.value, format.value));

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
