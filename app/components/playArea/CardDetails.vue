<template>
  <LazyUModal
    v-if="!!card"
    v-model:open="open"
    :ui="{ content: 'flex flex-row gap-3 p-6' }"
    title="Card details"
    description="Actions and info about this card"
  >
    <template #content>
      <div>
        <img
          :src="card.image_uri"
          :alt="card.name"
          class="max-h-[80svh] mtg-card-display"
        />
      </div>

      <div class="flex flex-col gap-3">
        <UButton
          color="neutral"
          variant="soft"
          size="xl"
          @click="toggleTap"
        >
          <span
            :class="['ms', `ms-${card.tapped ? 'untap' : 'tap'}`, 'ms-2x']"
          />
          {{ card.tapped ? 'Untap' : 'Tap' }}
        </UButton>

        <UButton
          color="primary"
          variant="soft"
          size="xl"
          @click="() => emit('showCardModifiers', card!)"
        >
          <span class="ms ms-ability-first-strike ms-2x" />
          Counters
        </UButton>

        <UInputNumber
          v-model="card.faceNumber"
          :min="0"
          title="Number"
        />

        <LazyUSeparator />

        <UButton
          v-if="hasAttachments"
          icon="i-lucide-unlink"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="explodeStack"
        >
          Detach all
        </UButton>
        <UButton
          v-else-if="!isAttached"
          icon="i-lucide-link"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="startAttaching"
        >
          Attach to...
        </UButton>
        <UButton
          v-else
          icon="i-lucide-unlink"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="tryDetach"
        >
          Detach
        </UButton>

        <UDropdownMenu
          :items="[
            {
              label: 'Copy card',
              icon: 'i-lucide-copy',
              color: 'primary',
            },
            {
              label: 'Copy card + counters',
              icon: 'i-lucide-copy-plus',
            },
            {
              label: 'Copy everything',
              icon: 'i-lucide-square-stack',
            },
          ]"
          :content="{
            align: 'start',
            side: 'bottom',
          }"
          size="xl"
        >
          <UButton
            icon="i-lucide-copy"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            size="xl"
          >
            Copy
          </UButton>
        </UDropdownMenu>

        <UButton
          icon="i-lucide-trash"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="confirmRemoval"
        >
          Remove
        </UButton>

        <LazyUSeparator />

        <UButton
          icon="i-lucide-external-link"
          color="info"
          variant="ghost"
          size="xl"
          :to="card.scryfall_uri"
          target="_blank"
        >
          Scryfall
        </UButton>
      </div>
    </template>
  </LazyUModal>

  <PlayAreaRemoveCardModal
    v-model="showConfirmRemove"
    :card="props.card"
    @canceled="confirmRemovedCanceled"
    @removed="cardRemoved"
  />
</template>

<script setup lang="ts">
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  card: BoardCard | undefined;
}>();

const emit = defineEmits<{
  showCardModifiers: [BoardCard];
}>();

const battlefield = useBattlefieldStore();

const showConfirmRemove = ref(false);

const confirmRemovedCanceled = () => {
  showConfirmRemove.value = false;
  open.value = true;
};

const cardRemoved = () => {
  showConfirmRemove.value = false;
  open.value = false;
};

const toggleTap = () => {
  if (!props.card) return;

  props.card.tapped = !props.card.tapped;

  open.value = false;
};

const hasAttachments = computed(() => {
  if (!props.card || !props.card.stack?.primary) return false;

  if (props.card.stack.primary !== props.card) return false;

  if (!props.card.stack.attachments?.size) return false;

  return true;
});

const isAttached = computed(() => {
  if (!props.card?.stack?.attachments) return false;

  return props.card.stack.attachments.has(props.card);
});

const startAttaching = () => {
  battlefield.startAttaching(props.card!);
  open.value = false;
};

const tryDetach = () => {
  battlefield.detach(props.card!);
  open.value = false;
};

const explodeStack = () => {
  battlefield.explodeStack(props.card!.stack!);
  open.value = false;
};

const confirmRemoval = () => {
  showConfirmRemove.value = true;
  open.value = false;
};
</script>
