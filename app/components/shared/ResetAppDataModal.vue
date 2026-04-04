<template>
  <LazyUModal
    v-model:open="open"
    :ui="{
      title: 'flex items-center gap-2 text-inverted',
      description: 'text-inverted',
      header: 'bg-error',
      body: 'flex flex-col gap-6',
      footer: 'flex flex-row justify-between',
    }"
    :close="false"
    description="Confirm that you want to reset all app data"
  >
    <template #title>
      <UIcon
        name="i-lucide-circle-alert"
        class="size-5"
      />
      Confirm
    </template>

    <template #body>
      <p>This will remove:</p>
      <ul>
        <li>All cards on the board</li>
        <li>All history</li>
        <li>All settings</li>
      </ul>
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </UButton>
      <UButton
        icon="i-lucide-trash"
        color="error"
        variant="solid"
        @click="resetAppData"
      >
        Confirm
      </UButton>
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
const toast = useToast();
const battlefield = useBattlefield();
const settingsStore = useSettingsStore();
const onDeckStore = useOnDeckStore();

const open = defineModel<boolean>('open');

const resetAppData = () => {
  battlefield.clear();
  // TODO: Clear history
  onDeckStore.clearCard();
  settingsStore.clear();

  open.value = false;

  toast.add({
    title: 'App data reset',
    color: 'info',
  });
};
</script>
