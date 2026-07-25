<template>
  <LazyUModal
    v-model:open="showConfirmRemove"
    :ui="{
      title: 'flex items-center gap-2',
      header: 'bg-error/45 text-xl',
      body: 'flex flex-col gap-6',
      footer: 'flex flex-row justify-between',
    }"
    :close="false"
  >
    <template #body>
      <p>
        Do you want to remove
        <code class="bg-accented">{{ props.card.name }}</code> from the
        battlefield?
      </p>

      <p v-if="cardIsStackPrimary && stackHasAttachmentsOrUnders">All cards in this stack will be detached.</p>
    </template>

    <template #title>
      <UIcon
        name="i-lucide-circle-alert"
        class="size-6"
      />
      Confirm
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xl"
        @click="emit('canceled')"
      >
        Cancel
      </UButton>

      <UButton
        icon="i-lucide-trash"
        color="error"
        variant="solid"
        size="xl"
        @click="removeCard"
      >
        Remove
      </UButton>
    </template>
  </LazyUModal>
</template>

<script setup lang="ts">
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';

const battlefield = useBattlefieldStore();

const showConfirmRemove = defineModel({ type: Boolean, default: false });

const props = defineProps<{
  card: BoardCard;
}>();

const emit = defineEmits(['canceled', 'removed']);

const cardStack = computed(() => props.card.stack);

const cardIsStackPrimary = computed(
  () => cardStack.value?.primary === props.card,
);

const stackHasAttachmentsOrUnders = computed(() => props.card.stack?.attachments.size || props.card.stack?.unders.size)

const removeCard = () => {
  battlefield.removeCardFromStack(props.card);
  
  emit('removed')
};
</script>
