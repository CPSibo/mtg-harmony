<template>
  <UButton
    variant="solid"
    color="primary"
    size="xl"
    :title="label"
    :aria-label="label"
    @click="act"
  >
    <span
      class="ms ms-2x"
      :class="tapsSelection ? 'ms-tap' : 'ms-untap'"
    />
  </UButton>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { computed } from 'vue';
import { manaIcon } from '~/components/shared/manaIcon';
import { cardsLabel, useActionToast } from '~/composables/useActionToast';
import { useBattlefieldStore, useSelectionStore } from '~/features/battlefield';

const battlefield = useBattlefieldStore();
const selection = useSelectionStore();

/**
 * Untap all, or with a selection, taps or untaps the selected cards (#235):
 * Tap if any is untapped, else Untap.
 */
const selected = computed(() => selection.stacks().map((s) => s.primary));
const tapsSelection = computed(() => selected.value.some((c) => !c.tapped));
const label = computed(() => {
  if (!selection.size) return 'Untap all';
  const what = selection.size === 1 ? 'selected card' : 'selected cards';
  return `${tapsSelection.value ? 'Tap' : 'Untap'} ${what}`;
});

// The same toasts as Untap all and the selection's Tap (#237).
const actionToast = useActionToast();

function act() {
  if (selection.size) {
    const cards = selected.value;
    const tapping = tapsSelection.value;
    battlefield.tapOrUntap(cards);
    // One card turning says enough; several get a toast (#237).
    if (cards.length > 1)
      actionToast(
        'selection.tap',
        `${tapping ? 'Tapped' : 'Untapped'} ${cardsLabel(cards)}`,
        manaIcon(tapping ? 'ms-tap' : 'ms-untap'),
      );
  } else {
    const several = battlefield.untapAllCount() > 1;
    battlefield.untapAll();
    if (several)
      actionToast(
        'board.untapAll',
        'Untapped every card',
        'i-lucide-rotate-ccw',
      );
  }
}
</script>
