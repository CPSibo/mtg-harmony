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

function act() {
  if (selection.size) battlefield.tapOrUntap(selected.value);
  else battlefield.untapAll();
}
</script>
