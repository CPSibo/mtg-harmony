<template>
  <UModal
    v-model:open="open"
    title="Create token"
    :description="`Tokens ${source.scryfallInfo.name} makes`"
  >
    <template #body>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li
          v-for="token in tokens"
          :key="token.id"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-md border border-default bg-elevated p-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            :disabled="!!creating || (!online && !fetched[token.id])"
            :aria-busy="creating === token.id"
            @click="pick(token)"
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-semibold text-highlighted">
                {{ token.name }}
              </span>
              <span
                v-if="typeLine(token)"
                class="text-sm text-muted"
              >
                {{ typeLine(token) }}
              </span>
              <!-- Tells apart tokens that share a name, once fetched. -->
              <span
                v-if="rulesText(token)"
                class="line-clamp-2 text-xs text-muted"
              >
                {{ rulesText(token) }}
              </span>
            </span>
            <span
              v-if="powerToughness(token)"
              class="font-semibold text-highlighted tabular-nums"
            >
              {{ powerToughness(token) }}
            </span>
            <UIcon
              v-else-if="creating === token.id"
              name="i-lucide-loader-circle"
              class="size-5 animate-spin"
            />
          </button>
        </li>
      </ul>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { useOnline } from '@vueuse/core';
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useCreateToken } from '~/composables/useCreateToken';
import { fetchCardById } from '~/composables/useScryfall';
import { tokenParts } from '~/features/battlefield/tokens';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard, ScryfallRelatedCard } from '~/types/Scryfall';

/**
 * Picks which of a card's tokens to create (#203). Names and type lines come
 * from the card itself, so the list shows at once. Each token is then
 * fetched in turn, filling in its power and toughness, so picking one
 * creates it without waiting.
 */
const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ source: BoardCard }>();

const online = useOnline();
const tokens = computed(() => tokenParts(props.source.scryfallInfo));
// A handful of small cards, replaced whole as each arrives.
const fetched = ref<Record<string, ScryfallCard>>({});
const { create, creating } = useCreateToken();

const typeLine = (token: ScryfallRelatedCard) =>
  fetched.value[token.id]?.type_line ?? token.type_line;

const rulesText = (token: ScryfallRelatedCard) => {
  const card = fetched.value[token.id];
  return card?.oracle_text ?? card?.card_faces?.[0]?.oracle_text ?? '';
};

function powerToughness(token: ScryfallRelatedCard) {
  const card = fetched.value[token.id];
  const face = card?.card_faces?.[0];
  const power = card?.power ?? face?.power;
  const toughness = card?.toughness ?? face?.toughness;
  return power !== undefined && toughness !== undefined
    ? `${power}/${toughness}`
    : '';
}

// Fetches stop once the picker closes.
let fetching = 0;
async function fetchAll() {
  const run = ++fetching;
  for (const token of tokens.value) {
    if (run !== fetching || !open.value) return;
    if (fetched.value[token.id]) continue;
    try {
      const card = await fetchCardById(token.id);
      fetched.value = { ...fetched.value, [token.id]: card };
    } catch {
      // Offline or not found: picking it tries again and says if it fails.
    }
  }
}

watch(open, (isOpen) => (isOpen ? void fetchAll() : fetching++), {
  immediate: true,
});
onScopeDispose(() => fetching++);

async function pick(token: ScryfallRelatedCard) {
  if (await create(props.source, token, fetched.value[token.id]))
    open.value = false;
}
</script>
