<template>
  <UModal
    v-model:open="open"
    title="Swap art"
    :description="`Printings of ${card.name}, newest first`"
    :ui="{ content: 'sm:max-w-4xl', body: 'flex flex-col gap-3' }"
  >
    <template #body>
      <UInput
        v-model="setFilter"
        icon="i-lucide-search"
        placeholder="Filter by set code (e.g. M10)"
        aria-label="Filter by set code"
        :loading="status === 'pending'"
        autofocus
        class="w-full"
      />

      <p
        v-if="emptyMessage"
        class="py-6 text-center text-sm text-muted"
      >
        {{ emptyMessage }}
      </p>

      <ul
        v-else
        class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6"
      >
        <li
          v-for="printing in visible"
          :key="printing.card.id"
        >
          <button
            type="button"
            class="flex w-full flex-col items-center gap-1 rounded-md p-1 hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
            :class="{
              'ring-2 ring-primary': printing.card.id === card.scryfallInfo.id,
            }"
            :aria-current="printing.card.id === card.scryfallInfo.id"
            :title="`${printing.set.toUpperCase()} #${printing.collectorNumber}`"
            @click="choose(printing)"
          >
            <img
              v-if="settings.imagesEnabled && imageOf(printing)"
              :src="imageOf(printing)!"
              :alt="`${card.name} (${printing.set.toUpperCase()})`"
              loading="lazy"
              class="mtg-card-display w-full"
            />
            <span class="text-xs text-muted">
              {{ printing.set.toUpperCase() }} #{{ printing.collectorNumber }}
            </span>
          </button>
        </li>
      </ul>

      <UPagination
        v-if="pageCount > 1"
        v-model:page="page"
        :total="total"
        :items-per-page="PRINTINGS_PAGE_SIZE"
        class="self-center"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UInput from '@nuxt/ui/components/Input.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import UPagination from '@nuxt/ui/components/Pagination.vue';
import { refDebounced } from '@vueuse/core';
import { computed, ref } from 'vue';
import { pickImageUri } from '~/composables/useScryfall';
import { useBattlefieldStore } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import type { BoardCard } from '~/types/PlayArea';
import { PRINTINGS_PAGE_SIZE, usePrintings, type Printing } from '..';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{ card: BoardCard }>();

const battlefield = useBattlefieldStore();
const settings = useSettingsStore();

const setFilter = ref('');
const setFilterDebounced = refDebounced(setFilter, 500);

const { visible, page, pageCount, status, total } = usePrintings(
  () => ({
    name: props.card.scryfallInfo.name,
    oracleId: props.card.scryfallInfo.oracle_id,
  }),
  setFilterDebounced,
);

const emptyMessage = computed(() => {
  if (status.value === 'error') return 'Loading printings failed. Try again.';
  if (status.value === 'pending' && !visible.value.length) return 'Loading…';
  if (status.value === 'success' && !visible.value.length)
    return setFilterDebounced.value.trim()
      ? 'No printings in that set.'
      : 'No printings found.';
  return '';
});

function imageOf(printing: Printing) {
  return pickImageUri(printing.card);
}

function choose(printing: Printing) {
  battlefield.swapPrinting(props.card, printing.card);
  open.value = false;
}
</script>
