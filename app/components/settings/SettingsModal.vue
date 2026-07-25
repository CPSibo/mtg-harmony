<template>
  <UModal
    :close="{ onClick: () => emit('close', false) }"
    :ui="{
      title: 'flex items-center gap-2',
      body: 'flex flex-col gap-6',
      content: 'max-w-[50svw] min-h-[50svh]',
    }"
    description="Settings are automatically saved to this device"
  >
    <template #title>
      <UIcon
        name="i-lucide-settings"
        class="size-5"
      />
      Settings
    </template>

    <template #body>
      <UTabs
        :items="items"
        variant="pill"
        size="xl"
        class="w-full"
        :ui="{ content: 'mt-4 flex flex-col gap-6 self-center max-w-[25em]' }"
      >
        <template #general>
          <UFormField
            label="Keep screen awake"
            description="Turn off to allow the device to sleep as normal"
          >
            <USwitch v-model="wakeLockEnabled" />
          </UFormField>

          <UFormField
            label="Show card images"
            description="Turn off to save mobile data"
          >
            <USwitch v-model="imagesEnabled" />
          </UFormField>
        </template>

        <template #on-deck>
          <UFormField
            label="Prefetch card count"
            description="How many cards to queue up in advance. Higher values feel more responsive but use more data"
          >
            <UInputNumber
              v-model="fetchCardCount"
              :min="minQueuedCardCount"
              :max="50"
            />
          </UFormField>

          <UFormField
            label="Minimum queued cards"
            description="Automatically fetches more card data once the queue drops below this number"
          >
            <UInputNumber
              v-model="minQueuedCardCount"
              :min="1"
              :max="fetchCardCount"
            />
          </UFormField>

          <UFormField
            label="Preload card image"
            description="Fetches next card's image early. Uses more data but makes app feel snappier"
          >
            <USwitch v-model="preloadImagesEnabled" />
          </UFormField>
        </template>

        <template #field>
          <UFormField
            label="Grid snapping"
            description="Snap cards to a grid of the given size. 0 to disable"
          >
            <UInputNumber
              v-model="snapScale"
              :min="0"
            />
          </UFormField>

          <UFormField
            label="Card outline"
            description="Show an outline around cards to help visibility. Selected cards always have an outline"
          >
            <USelect
              v-model="cardOutline"
              :items="cardOutlines"
              class="w-1/2 max-w-full"
            />
          </UFormField>
        </template>
      </UTabs>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';

const emit = defineEmits<{ close: [boolean] }>();

const settingsStore = useSettingsStore();
const { wakeLockEnabled, imagesEnabled } = storeToRefs(settingsStore);

const discordFetchStore = useDiscordFetcherStore();
const { fetchCardCount, minQueuedCardCount, preloadImagesEnabled } =
  storeToRefs(discordFetchStore);

const battlefieldStore = useBattlefieldStore();
const { snapScale } = storeToRefs(battlefieldStore);

const cardOutline = ref('never');
const cardOutlines = ref<SelectItem[]>([
  {
    label: 'Never',
    value: 'never',
  },
  {
    label: 'Hover',
    value: 'hover',
  },
  {
    label: 'Always',
    value: 'always',
  },
]);

const items = [
  {
    label: 'General',
    icon: 'i-lucide-sliders-horizontal',
    slot: 'general',
  },
  {
    label: 'On-deck',
    icon: 'i-lucide-scan-search',
    slot: 'on-deck',
  },
  {
    label: 'Field',
    icon: 'i-lucide-layout-grid',
    slot: 'field',
  },
];
</script>
