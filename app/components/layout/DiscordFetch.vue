<template>
  <USlideover
    v-model:open="drawerIsOpen"
    side="left"
    title="On-deck"
    description="Fetch random non-land, paper cards"
    :modal="false"
    :dismissible="false"
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
          class="mtg-card-display"
        />
        <img
          v-else-if="!!card?.image_uri"
          :src="card?.image_uri"
          :alt="card?.name ?? 'Missing card'"
          class="mtg-card-display"
        />
        <LazySharedPlaceholder
          v-else
          class="cursor-pointer mtg-card-display"
          @click="fetch"
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

      <div class="mt-5 flex gap-4 flex-col">
        <UButton
          color="primary"
          variant="subtle"
          icon="i-lucide-arrow-down-to-line"
          :loading="loading"
          size="xl"
          @click="fetch"
        >
          Fetch next
        </UButton>

        <UButton
          color="secondary"
          variant="subtle"
          icon="i-lucide-user-plus"
          :loading="loading"
          :disabled="!card?.id"
          size="xl"
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
          @click="onDeck.clearCard"
        >
          Clear
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
const toast = useToast();

const drawerIsOpen = ref(false);

const scryfall = useScryfall();

const onDeck = useOnDeckStore();
const { card } = storeToRefs(onDeck);

const board = useBattlefield();

const loading = ref<boolean>();

const fetch = async () => {
  try {
    loading.value = true;

    onDeck.clearCard();

    const response = await scryfall.fetch();

    if (!response) {
      toast.add({
        title: 'Fetch Error',
        description: `Could not fetch card`,
        color: 'error',
      });

      return;
    }

    if (typeof response === 'string') {
      toast.add({
        title: 'Fetch Error',
        description: `Could not fetch card: ${response}`,
        color: 'error',
      });

      return;
    }

    onDeck.setCard(response.data);
  } catch {
    toast.add({
      title: 'Fetch Error',
      description: `Could not fetch card`,
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};

const cast = () => {
  if (!card.value?.id) return;

  board.addStackByCard(card.value);

  onDeck.clearCard();

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
