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
          v-model="card.stack!.counter"
          :min="0"
          title="Number"
          :disabled="!card.stack"
        />

        <LazyUSeparator />

        <UButton
          v-if="!isAttached"
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

        <UDropdownMenu
          :items="[
            {
              label: 'Destroy',
              icon: 'i-lucide-swords',
              color: 'primary',
            },
            {
              label: 'Exile',
              icon: 'i-lucide-ban',
              color: 'warning',
            },
            {
              label: 'Delete',
              icon: 'i-lucide-trash',
              color: 'error',
            },
          ]"
          :content="{
            align: 'start',
            side: 'bottom',
          }"
          size="xl"
        >
          <UButton
            icon="i-lucide-trash"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            size="xl"
          >
            Remove
          </UButton>
        </UDropdownMenu>

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
</template>

<script setup lang="ts">
import type { BoardCard } from '~/types/PlayArea';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  card: BoardCard | undefined;
}>();

const emit = defineEmits<{
  showCardModifiers: [BoardCard];
}>();

const battlefield = useBattlefield();

const toggleTap = () => {
  if (!props.card) return;

  props.card.tapped = !props.card.tapped;

  open.value = false;
};

const isAttached = computed(() => {
  if (!props.card || !props.card.stack?.attachments) return false;

  return props.card.stack.attachments.includes(props.card);
});

const startAttaching = () => {
  battlefield.startAttaching(props.card!);
  open.value = false;
};

const tryDetach = () => {
  battlefield.detach(props.card!);
  open.value = false;
};
</script>
