<template>
  <!-- Which door a Room cast to the board opens (#145). Closing it any other
       way leaves both locked, as for a Room that enters without being cast. -->
  <UModal
    :open="!!card"
    title="Which door opens?"
    :description="card?.scryfallInfo.name"
    :ui="{ body: 'flex flex-col gap-2', footer: 'flex justify-end' }"
    @update:open="(open) => !open && battlefield.chooseDoors()"
  >
    <template #body>
      <UButton
        v-for="(door, i) in doors"
        :key="door.name"
        icon="i-lucide-door-open"
        color="primary"
        variant="soft"
        size="xl"
        block
        class="justify-start"
        @click="battlefield.chooseDoors([i])"
      >
        <span class="flex-1 text-left">{{ door.name }}</span>
        <span
          class="flex items-center gap-0.5"
          :aria-label="door.cost"
        >
          <template
            v-for="(part, j) in manaSymbols(door.cost)"
            :key="j"
          >
            <i
              v-if="'symbol' in part"
              :class="part.symbol"
              aria-hidden="true"
            />
            <span v-else>{{ part.text }}</span>
          </template>
        </span>
      </UButton>
      <UButton
        icon="i-lucide-door-open"
        color="neutral"
        variant="soft"
        size="xl"
        block
        class="justify-start"
        @click="battlefield.chooseDoors([0, 1])"
      >
        Both doors
      </UButton>
    </template>

    <template #footer>
      <UButton
        icon="i-lucide-lock"
        color="neutral"
        variant="ghost"
        @click="battlefield.chooseDoors()"
      >
        Keep both locked
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { computed } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { manaSymbols } from '~/utils/manaSymbols';

const battlefield = useBattlefieldStore();
const card = computed(() => battlefield.doorChoice);
const doors = computed(
  () =>
    card.value?.scryfallInfo.card_faces?.map((face) => ({
      name: face.name,
      cost: face.mana_cost ?? '',
    })) ?? [],
);
</script>
