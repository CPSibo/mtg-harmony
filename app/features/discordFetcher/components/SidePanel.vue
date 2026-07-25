<template>
  <USlideover
    v-model:open="drawerIsOpen"
    side="left"
    title="On-deck"
    description="Fetch random non-land, paper cards"
    :modal="false"
    :dismissible="false"
    :ui="{
      overlay: 'bg-elevated',
      content: 'border-primary-900! border-r-3',
    }"
  >
    <UButton
      variant="solid"
      color="primary"
      size="xl"
      title="Show on-deck card"
      icon="i-lucide-scan-search"
    >
      On-deck
    </UButton>

    <template #body>
      <div class="on-deck-display">
        <LazyUSkeleton
          v-if="loading"
          class="mtg-card-display vertical"
        />
        <img
          v-else-if="!!card?.image_uri"
          :src="card?.image_uri"
          :alt="card?.name ?? 'Missing card'"
          class="mtg-card-display vertical"
        />
        <LazySharedPlaceholder
          v-else
          class="cursor-pointer mtg-card-display vertical"
          @click="goNext"
        >
          <div class="flex flex-col gap-3 items-center">
            <UIcon
              name="i-lucide-arrow-down-to-line"
              class="text-primary text-4xl"
            />
            Tap to fetch next card
          </div>
        </LazySharedPlaceholder>
      </div>

      <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-arrow-left"
          :disabled="!canGoPrevious"
          size="xl"
          @click="discordFetchStore.prev"
        >
          Prev card
        </UButton>

        <UButton
          color="primary"
          variant="subtle"
          icon="i-lucide-arrow-right"
          :loading="loading"
          size="xl"
          @click="goNext"
        >
          Next card
        </UButton>

        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-user-plus"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="cast"
        >
          Cast to board
        </UButton>

        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-wand-sparkles"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="cast"
        >
          Cast to graveyard
        </UButton>

        <UButton
          color="error"
          variant="ghost"
          icon="i-lucide-x"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
          class="md:col-span-2"
          @click="discordFetchStore.clearCard"
        >
          Clear
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '..';

const toast = useToast();

const drawerIsOpen = ref(false);

const discordFetchStore = useDiscordFetcherStore();
const { card, canGoPrevious } = storeToRefs(discordFetchStore);

const board = useBattlefieldStore();

const loading = ref(false);

const goNext = async () => {
  try {
    loading.value = true;

    const result = await discordFetchStore.next();

    if (!result.success) {
      toast.add({
        title: 'Fetch Error',
        description: result.error ?? 'Could not fetch card',
        color: 'error',
      });
    }
  } finally {
    loading.value = false;
  }
};

const cast = () => {
  if (!card.value?.id) return;

  board.addStackByCard(card.value);

  discordFetchStore.clearCard();

  drawerIsOpen.value = false;
};
</script>

<style lang="scss" scoped>
.on-deck-display {
  height: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
