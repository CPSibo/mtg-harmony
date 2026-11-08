<template>
  <UModal
    v-model:open="log.windowIsOpen"
    title="Event log"
    description="What happened this game and before, newest first"
    :ui="{ body: 'flex flex-col gap-3' }"
  >
    <template #body>
      <div class="flex flex-wrap gap-2">
        <UInput
          v-model="name"
          icon="i-lucide-search"
          placeholder="Card name"
          aria-label="Filter by card name"
          class="grow"
        />
        <USelectMenu
          v-model="types"
          :items="typeItems"
          value-key="value"
          multiple
          placeholder="All events"
          aria-label="Filter by event"
          class="min-w-44"
        />
        <UButton
          icon="i-lucide-share"
          color="neutral"
          variant="outline"
          @click="exportOpen = true"
        >
          Export
        </UButton>
      </div>

      <ExportLogModal v-model:open="exportOpen" />

      <p
        v-if="log.archiveAvailable === false"
        class="text-xs text-muted"
      >
        This browser can't keep past games, so the log shows this game only.
      </p>

      <p
        v-if="!shown.length"
        class="py-6 text-center text-sm text-muted"
      >
        {{ emptyMessage }}
      </p>

      <ul
        v-else
        class="flex flex-col divide-y divide-default max-h-[60svh] overflow-y-auto"
        aria-label="Events"
      >
        <li
          v-for="entry in shown"
          :key="entry.id"
          class="flex items-center gap-3 py-2"
          :class="{ 'bg-elevated/50': entry.type === 'gameMarker' }"
        >
          <img
            v-if="
              'card' in entry && entry.card.imageUri && settings.imagesEnabled
            "
            :src="entry.card.imageUri"
            alt=""
            class="w-8 rounded-sm mtg-card-display"
          />
          <UIcon
            v-else
            :name="EVENT_LABELS[entry.type].icon"
            class="size-8 p-1.5 text-muted"
          />

          <div class="flex flex-col grow min-w-0">
            <span class="truncate">{{ describeEntry(entry) }}</span>
            <time
              class="text-xs text-muted"
              :datetime="new Date(entry.at).toISOString()"
            >
              {{ formatTime(entry.at) }}
            </time>
          </div>

          <UButton
            v-if="entry.type === 'fetched'"
            icon="i-lucide-sparkles"
            size="sm"
            variant="soft"
            :aria-label="`Cast ${entry.card.name}`"
            @click="castAgain(entry.card)"
          >
            Cast
          </UButton>
        </li>
      </ul>

      <p
        v-if="matching.length > shown.length"
        class="text-xs text-muted text-center"
      >
        Showing the newest {{ shown.length }} of {{ matching.length }}. Filter
        to find older events.
      </p>
    </template>

    <template
      v-if="log.archiveAvailable !== false"
      #footer
    >
      <UButton
        icon="i-lucide-trash"
        :color="confirmingClear ? 'error' : 'neutral'"
        :variant="confirmingClear ? 'solid' : 'ghost'"
        size="sm"
        @click="clearHistory"
      >
        {{
          confirmingClear
            ? 'Click again to clear past games'
            : 'Clear past games'
        }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import { useToast } from '@nuxt/ui/composables';
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import ExportLogModal from './ExportLogModal.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import {
  EVENT_LABELS,
  EVENT_TYPES,
  describeEntry,
  filterEntries,
  scryfallCardFromSnapshot,
  useEventLogStore,
  type EventType,
  type LoggedCard,
} from '..';

/** Rendering thousands of rows at once is slow on phones. */
const MAX_SHOWN = 200;

const log = useEventLogStore();
const battlefield = useBattlefieldStore();
const settings = useSettingsStore();
const toast = useToast();

const exportOpen = ref(false);
const name = ref('');
const nameDebounced = refDebounced(name, 200);
const types = ref<EventType[]>([]);

const typeItems = EVENT_TYPES.map((value) => ({
  value,
  label: EVENT_LABELS[value].label,
  icon: EVENT_LABELS[value].icon,
}));

// Past games live in IndexedDB; read them when the window opens.
watch(
  () => log.windowIsOpen,
  (open) => {
    if (open) void log.loadHistory();
    else confirmingClear.value = false;
  },
  { immediate: true },
);

const emptyMessage = computed(() => {
  if (log.historyLoading) return 'Loading past games…';
  return log.history.length ? 'No events match.' : 'Nothing logged yet.';
});

/** Clear past games asks for a second click, within a few seconds. */
const confirmingClear = ref(false);
let confirmTimer: ReturnType<typeof setTimeout> | undefined;
function clearHistory() {
  clearTimeout(confirmTimer);
  if (!confirmingClear.value) {
    confirmingClear.value = true;
    confirmTimer = setTimeout(() => (confirmingClear.value = false), 4000);
    return;
  }
  confirmingClear.value = false;
  log.clearHistory();
  toast.add({ title: 'Past games cleared', color: 'info' });
}

const matching = computed(() =>
  filterEntries(log.history, {
    types: types.value,
    name: nameDebounced.value,
  }),
);
const shown = computed(() => matching.value.slice(0, MAX_SHOWN));

const today = new Date().toDateString();
function formatTime(at: number) {
  const date = new Date(at);
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return date.toDateString() === today
    ? time
    : `${date.toLocaleDateString()} ${time}`;
}

/** Casts a fetched card again, such as after an accidental refetch. */
function castAgain(card: LoggedCard) {
  battlefield.castCard(scryfallCardFromSnapshot(card));
  toast.add({ title: `Cast ${card.name}`, color: 'success' });
}
</script>
