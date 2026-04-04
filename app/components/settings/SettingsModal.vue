<template>
  <UModal
    :close="{ onClick: () => emit('close', false) }"
    :ui="{ title: 'flex items-center gap-2', body: 'flex flex-col gap-6' }"
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
      <UFormField
        label="Keep screen awake"
        description="Turn off to allow the device to sleep as normal"
      >
        <USwitch v-model="wakeLockEnabled" />
      </UFormField>

      <UFormField
        label="Show images"
        description="Turn off to save mobile data"
      >
        <USwitch v-model="imagesEnabled" />
      </UFormField>

      <UFormField
        label="Prefetch cards"
        description="Significantly increases app responsiveness"
      >
        <USwitch v-model="prefetchEnabled" />
      </UFormField>

      <UFormField
        label="Snap grid"
        description="Whether to snap cards to a grid. 0 to disable"
      >
        <UInputNumber
          v-model="snapScale"
          :min="0"
        />
      </UFormField>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [boolean] }>();

const settingsStore = useSettingsStore();
const { prefetchEnabled, wakeLockEnabled, imagesEnabled, snapScale } =
  storeToRefs(settingsStore);
</script>
