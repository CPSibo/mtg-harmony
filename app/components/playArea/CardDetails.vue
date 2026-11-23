<template>
  <UModal
    v-if="!!card"
    v-model:open="open"
    :ui="{
      content: [
        // Below sm the image sits above the buttons, full width, and the
        // whole window scrolls (#176).
        'flex flex-col gap-3 p-6 max-sm:max-h-[calc(100svh-2rem)] max-sm:overflow-y-auto sm:flex-row',
        // Wide enough for the image to be bigger than on the board (#176).
        // A sideways card fills what the buttons leave; a portrait one sets
        // its own width, and the window fits it.
        showImage && landscape && 'sm:max-w-4xl',
        // w-max, not w-auto: centred with left: 50%, auto would cap it at 50vw.
        showImage && !landscape && 'sm:w-max sm:max-w-[calc(100vw-2rem)]',
        // Text-only cards otherwise get squeezed by the buttons.
        !showImage && 'sm:max-w-2xl',
      ],
    }"
    title="Card details"
    description="Actions and info about this card"
  >
    <template #content>
      <!-- A sideways image fills what the buttons leave, giving way so they
           always fit. -->
      <div
        :class="[
          'flex flex-col gap-3 sm:max-h-[90svh] sm:overflow-y-auto',
          { 'min-w-0 flex-1': landscape || !showImage },
        ]"
      >
        <SharedCardImage
          v-if="showImage"
          :landscape="landscape"
          frame-class="w-full"
          :src="shownImageUri(card)"
          :alt="card.name"
          class="mtg-card-display"
          :class="landscape ? 'max-h-[80svh]' : 'details-portrait'"
        />
        <!-- As wide as the image, never wider. -->
        <SharedOracleText
          v-if="showImage && faces.length"
          :faces="faces"
          class="w-0 min-w-full"
        />
        <SharedCardText
          v-else
          :card="card.scryfallInfo"
          role="img"
          :aria-label="card.name"
          class="w-72 max-w-full shrink-0"
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
          icon="i-lucide-flip-horizontal-2"
          color="neutral"
          variant="soft"
          size="xl"
          @click="flipOver"
        >
          Flip over
        </UButton>

        <UButton
          :icon="showImage ? 'i-lucide-text' : 'i-lucide-image'"
          color="neutral"
          variant="soft"
          size="xl"
          @click="battlefield.toggleShownAs(card!, settings.imagesEnabled)"
        >
          {{ showImage ? 'Show text' : 'Show art' }}
        </UButton>

        <UButton
          v-if="canTurn(card)"
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="soft"
          size="xl"
          @click="turn"
        >
          Flip 180°
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
              onSelect: () => copyCard(card!, 'card'),
              color: 'primary',
            },
            {
              label: 'Copy card + counters',
              icon: 'i-lucide-copy-plus',
              onSelect: () => copyCard(card!, 'counters'),
            },
            {
              label: 'Copy everything',
              icon: 'i-lucide-square-stack',
              onSelect: () => copyCard(card!, 'stack'),
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
          icon="i-lucide-images"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="openSwapArt"
        >
          Swap art
        </UButton>

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

  <SwapArtModal
    v-if="swapArtLoaded && props.card"
    v-model:open="showSwapArt"
    :card="props.card"
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
import SharedOracleText from '~/components/shared/OracleText.vue';
import { useSettingsStore } from '~/stores/settings';
import { computed, defineAsyncComponent, ref } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import SharedCardImage from '~/components/shared/CardImage.vue';
import {
  canTurn,
  isLandscape,
  shownFaces,
  shownImageUri,
  showsImage,
} from '~/features/battlefield/cardFaces';
import { useCopyAnimation, useMoveAnimation } from '~/features/castAnimation';
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

// Loads on first use: most games never swap art.
const SwapArtModal = defineAsyncComponent(
  () => import('~/features/swapArt/components/SwapArtModal.vue'),
);
const swapArtLoaded = ref(false);
const showSwapArt = ref(false);

const openSwapArt = () => {
  swapArtLoaded.value = true;
  showSwapArt.value = true;
  open.value = false;
};

// Cancelling the removal goes back to the details.
const confirmRemovedCanceled = () => {
  open.value = true;
};

const toggleTap = () => {
  if (!props.card) return;

  battlefield.toggleTapped(props.card);

  open.value = false;
};

const flipOver = () => {
  if (!props.card) return;
  battlefield.toggleFlipped(props.card);
};

const turn = () => {
  if (!props.card) return;
  battlefield.toggleTurned(props.card);
  open.value = false;
};

const faces = computed(() => (props.card ? shownFaces(props.card) : []));

const showImage = computed(
  () => !!props.card && showsImage(props.card, settings.imagesEnabled),
);

const landscape = computed(() => !!props.card && isLandscape(props.card));

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

const animateMove = useMoveAnimation();
const copyCard = useCopyAnimation();

const tryDetach = () => {
  const card = props.card!;
  const play = animateMove([card.id]);
  const hostId = card.stack?.primary.id ?? null;
  battlefield.detach(card);
  play(hostId, false);
  open.value = false;
};

const explodeStack = () => {
  const stack = props.card!.stack!;
  const play = animateMove(
    [...stack.attachments, ...stack.unders].map((c) => c.id),
  );
  battlefield.explodeStack(stack);
  play(stack.primary.id, false);
  open.value = false;
};

const confirmRemoval = () => {
  showConfirmRemove.value = true;
  open.value = false;
};
</script>

<style scoped>
/* As tall as fits, leaving room beside it for the buttons. Full width below sm,
   where the buttons go underneath. */
.details-portrait {
  width: 100%;
  height: auto;
  aspect-ratio: var(--card-ratio-vertical);
}
@media (width >= 40rem) {
  .details-portrait {
    width: min(30rem, 80svh * 12 / 17, 100vw - 17rem);
  }
}
</style>
