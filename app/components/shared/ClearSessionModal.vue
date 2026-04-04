<template>
  <LazyUModal
    v-model:open="open"
    :ui="{
      title: 'flex items-center gap-2 text-inverted',
      description: 'text-inverted',
      header: 'bg-warning',
      body: 'flex flex-col gap-6',
      footer: 'flex flex-row justify-between',
    }"
    :close="false"
    description="Confirm that you want to clear the session"
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
        <li>All cards</li>
        <li>All history</li>
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
        icon="i-lucide-rotate-ccw"
        color="warning"
        variant="solid"
        @click="clearSession"
      >
        Confirm
      </UButton>
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
const toast = useToast();
const battlefield = useBattlefield();
const onDeckStore = useOnDeckStore();

const open = defineModel<boolean>('open');

const clearSession = () => {
  battlefield.clear();
  // TODO: Clear history
  onDeckStore.clearCard();

  open.value = false;

  toast.add({
    title: 'Session cleared',
    color: 'info',
  });
};
</script>
