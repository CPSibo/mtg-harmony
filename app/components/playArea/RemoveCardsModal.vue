<template>
  <UModal
    v-model:open="open"
    :ui="{
      title: 'flex items-center gap-2',
      header: 'bg-error/45 text-xl',
      body: 'flex flex-col gap-6',
      footer: 'flex flex-row justify-between',
    }"
    :close="false"
    :description="`Confirm removing ${what} from the battlefield`"
  >
    <template #title>
      <UIcon
        name="i-lucide-circle-alert"
        class="size-6"
      />
      Confirm
    </template>

    <template #body>
      <p>Do you want to remove {{ what }} from the battlefield?</p>
      <p v-if="freesOthers">
        Cards attached to them or under them stay on the board, detached.
      </p>
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xl"
        @click="open = false"
      >
        Cancel
      </UButton>
      <UButton
        icon="i-lucide-trash"
        color="error"
        size="xl"
        @click="remove"
      >
        Remove {{ what }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { computed } from 'vue';
import { useRemoveAllAnimation } from '~/features/castAnimation';
import type { BoardCard } from '~/types/PlayArea';

/**
 * Confirms removing the selected stacks' cards (#221), saying how many. Each
 * goes as a single Remove does: what's attached to it or under it stays.
 */
const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ cards: readonly BoardCard[] }>();
const emit = defineEmits<{ removed: [] }>();

const removeAll = useRemoveAllAnimation();

const what = computed(() =>
  props.cards.length === 1 ? '1 card' : `${props.cards.length} cards`,
);
const freesOthers = computed(() =>
  props.cards.some(
    (c) =>
      c.stack?.primary === c &&
      (c.stack.attachments.size || c.stack.unders.size),
  ),
);

function remove() {
  open.value = false;
  emit('removed');
  void removeAll(props.cards);
}
</script>
