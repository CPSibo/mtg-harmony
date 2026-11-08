<template>
  <UModal
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
        <li>All cards on the board</li>
        <li>The On-deck card and the cards fetched ahead</li>
      </ul>
      <p>The event log keeps everything and marks a new game.</p>
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
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { useReset } from '~/composables/useReset';
const reset = useReset();

const open = defineModel<boolean>('open');

const clearSession = () => {
  reset.clearSession();

  open.value = false;
};
</script>
