<template>
  <UModal
    v-if="!!card"
    v-model:open="open"
    :ui="{ content: 'flex flex-row gap-3 p-6' }"
    title="Card details"
    description="Actions and info about this card"
  >
    <template #content>
      <div>
        <img
          v-if="settings.imagesEnabled"
          :src="card.image_uri"
          :alt="card.name"
          class="max-h-[80svh] mtg-card-display"
        />
        <SharedCardText
          v-else
          :card="card.scryfallInfo"
          role="img"
          :aria-label="card.name"
          class="w-72"
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
          :model-value="card.faceNumber"
          :min="0"
          title="Number"
          @update:model-value="
            (value) => battlefield.setFaceNumber(card!, value ?? 0)
          "
        />

        <USeparator />

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
          v-else-if="!isAttached && !isUnder"
          icon="i-lucide-link"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="startAttaching"
        >
          Attach to...
        </UButton>
        <UButton
          v-else-if="isAttached"
          icon="i-lucide-unlink"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="tryDetach"
        >
          Detach
        </UButton>
        <UButton
          v-if="isUnder"
          icon="i-lucide-arrow-up-from-line"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="tryDetach"
        >
          Take out
        </UButton>
        <UButton
          v-else
          icon="i-lucide-layers"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="startPuttingUnder"
        >
          Put under...
        </UButton>

        <UDropdownMenu
          :items="[
            {
              label: 'Copy card',
              icon: 'i-lucide-copy',
              onSelect: () => battlefield.copyCard(card!, 'card'),
              color: 'primary',
            },
            {
              label: 'Copy card + counters',
              icon: 'i-lucide-copy-plus',
              onSelect: () => battlefield.copyCard(card!, 'counters'),
            },
            {
              label: 'Copy everything',
              icon: 'i-lucide-square-stack',
              onSelect: () => battlefield.copyCard(card!, 'stack'),
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

        <USeparator />

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
  </UModal>

  <PlayAreaRemoveCardModal
    v-model="showConfirmRemove"
    :card="props.card"
    @canceled="confirmRemovedCanceled"
  />
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue';
import UInputNumber from '@nuxt/ui/components/InputNumber.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import USeparator from '@nuxt/ui/components/Separator.vue';
import PlayAreaRemoveCardModal from '~/components/playArea/RemoveCardModal.vue';
import SharedCardText from '~/components/shared/CardText.vue';
import { useSettingsStore } from '~/stores/settings';
import { computed, ref } from 'vue';
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
const settings = useSettingsStore();

const showConfirmRemove = ref(false);

// Cancelling the removal goes back to the details.
const confirmRemovedCanceled = () => {
  open.value = true;
};

const toggleTap = () => {
  if (!props.card) return;

  battlefield.toggleTapped(props.card);

  open.value = false;
};

const hasAttachments = computed(() => {
  if (!props.card || !props.card.stack?.primary) return false;

  if (props.card.stack.primary !== props.card) return false;

  if (!props.card.stack.attachments.size && !props.card.stack.unders.size)
    return false;

  return true;
});

const isAttached = computed(() => {
  if (!props.card?.stack?.attachments) return false;

  return props.card.stack.attachments.has(props.card);
});

const isUnder = computed(() => !!props.card?.stack?.unders.has(props.card));

const startPuttingUnder = () => {
  battlefield.startAttaching(props.card!, 'under');
  open.value = false;
};

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
