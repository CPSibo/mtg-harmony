<template>
  <UModal
    v-model:open="open"
    title="Start a new game?"
    description="It's been over 2 hours since anything happened."
    :ui="{ footer: 'flex flex-row justify-between' }"
    @update:open="(value) => !value && dismiss()"
  >
    <template #body>
      <p>
        A new game clears the board and On-deck, like
        <strong>New game</strong> in the menu. The event log keeps everything.
      </p>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="dismiss"
      >
        Keep playing
      </UButton>
      <UButton
        icon="i-lucide-flag"
        color="primary"
        @click="startNewGame"
      >
        New game
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { useDocumentVisibility } from '@vueuse/core';
import { onMounted, ref, watch } from 'vue';
import { useReset } from '~/composables/useReset';
import { useBattlefieldStore } from '~/features/battlefield';
import { shouldOfferNewGame, useEventLogStore } from '..';

/**
 * A soft, dismissible offer of a new game after 2 hours without events,
 * when there are cards on the board. Checked when the app opens and when its tab comes back into view.
 */
const log = useEventLogStore();
const reset = useReset();
const battlefield = useBattlefieldStore();

const offerNewGame = () =>
  shouldOfferNewGame(log, Date.now(), battlefield.stacks.length > 0);
const open = ref(false);

function check() {
  if (offerNewGame()) open.value = true;
}

onMounted(check);
const visibility = useDocumentVisibility();
watch(visibility, (value) => value === 'visible' && check());

// Closing any way but "New game" (button, X, Escape) dismisses the offer.
function dismiss() {
  open.value = false;
  if (offerNewGame()) log.dismissNewGameOffer();
}

function startNewGame() {
  open.value = false;
  reset.newGame('idlePrompt');
}
</script>
