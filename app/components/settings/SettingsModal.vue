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
            :description="
              wakeLockSupported
                ? 'Turn off to allow the device to sleep as normal'
                : 'Not available in this browser'
            "
          >
            <USwitch
              v-model="wakeLockEnabled"
              :disabled="!wakeLockSupported"
            />
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
            description="Show an outline around cards on the board, which lights up on hover"
          >
            <USwitch v-model="cardOutlineEnabled" />
          </UFormField>

          <UFormField
            label="Pointer smoothing"
            description="Eases dragging and panning. May make the app feel better if you have a high refresh rate screen. Probably feels worse for touch devices. 0 to disable."
          >
            <div class="flex items-center gap-3">
              <USlider
                v-model="pointerSmoothing"
                :min="0"
                :max="MAX_POINTER_EASE_MS"
                :step="5"
                class="flex-1"
              />
              <span class="w-12 text-right text-sm tabular-nums">
                {{ pointerSmoothing ? `${pointerSmoothing} ms` : 'Off' }}
              </span>
            </div>
          </UFormField>

          <UFormField
            label="Attach menu delay"
            description="How long to hold a dragged card over another before the attach and put-under menu opens."
          >
            <div class="flex items-center gap-3">
              <USlider
                v-model="dragMenuDelay"
                :min="MIN_DRAG_MENU_DELAY_MS"
                :max="MAX_DRAG_MENU_DELAY_MS"
                :step="250"
                class="flex-1"
              />
              <span class="w-12 text-right text-sm tabular-nums">
                {{ (dragMenuDelay / 1000).toFixed(2).replace(/0$/, '') }} s
              </span>
            </div>
          </UFormField>
        </template>
      </UTabs>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UInputNumber from '@nuxt/ui/components/InputNumber.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import USlider from '@nuxt/ui/components/Slider.vue';
import { MAX_POINTER_EASE_MS } from '~/composables/pointerSmoothing';
import USwitch from '@nuxt/ui/components/Switch.vue';
import UTabs from '@nuxt/ui/components/Tabs.vue';
import { useSettingsStore } from '~/stores/settings';
import { useSupported } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import {
  MAX_DRAG_MENU_DELAY_MS,
  MIN_DRAG_MENU_DELAY_MS,
  useBattlefieldStore,
} from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';

const emit = defineEmits<{ close: [boolean] }>();

const settingsStore = useSettingsStore();
const {
  wakeLockEnabled,
  imagesEnabled,
  cardOutlineEnabled,
  pointerSmoothing,
  dragMenuDelay,
} = storeToRefs(settingsStore);

// The Wake Lock API needs a secure context (HTTPS or localhost).
const wakeLockSupported = useSupported(
  () => typeof navigator !== 'undefined' && 'wakeLock' in navigator,
);

const discordFetchStore = useDiscordFetcherStore();
const { fetchCardCount, minQueuedCardCount, preloadImagesEnabled } =
  storeToRefs(discordFetchStore);

const battlefieldStore = useBattlefieldStore();
const { snapScale } = storeToRefs(battlefieldStore);

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
