<template>
  <div
    ref="boardCard"
    :data-card-id="card.id"
    class="board-card origin-top-left flex gap-1"
    :class="{ tapped: card.tapped, sideways, landscape }"
    :style="{ '--rotate': `${rotation}deg` }"
  >
    <div
      class="card-image-wrapper cursor-pointer rounded-lg"
      :class="
        settings.cardOutlineEnabled
          ? 'border-slate-600 hover:border-primary-800'
          : 'border-transparent'
      "
    >
      <div
        ref="cardImageSection"
        class="card-image"
        role="img"
        :aria-label="card.name"
        :aria-description="lockedDescription"
        :style="
          showImage ? { backgroundImage: `url('${imageUri}')` } : undefined
        "
        title="Double tap to open"
        @click="tryAttach"
        @touchend="tryAttach"
      >
        <SharedCardText
          v-if="!showImage"
          :card="card.scryfallInfo"
          class="size-full"
        />

        <!-- A Room's locked doors, dimmed under a padlock (#145). In the
             image's own frame, before it turns to read: the first door is
             its bottom half. -->
        <template v-if="showImage && !card.flipped">
          <div
            v-for="door in card.lockedDoors"
            :key="door"
            class="door-lock"
            :class="door === 0 ? 'bottom-0' : 'top-0'"
            aria-hidden="true"
          >
            <UIcon
              name="i-lucide-lock"
              class="door-lock-icon"
            />
          </div>
        </template>

        <div
          v-if="!!card.faceNumber"
          class="face-number"
        >
          {{ card.faceNumber }}
        </div>

        <div
          v-if="battlefield.isAttaching && isHovered && isValidAttachmentTarget"
          class="attach-overlay text-5xl"
        >
          <UIcon
            :name="
              battlefield.attachMode === 'under'
                ? 'i-lucide-layers'
                : 'i-lucide-link'
            "
            class="text-primary"
          />
        </div>
      </div>
    </div>

    <div class="modifiers grid grid-flow-col gap-1 place-items-start">
      <!-- As text, there are no halves to dim: name the locked doors. -->
      <template v-if="!showImage">
        <span
          v-for="name in lockedNames"
          :key="name"
          class="modifier-icon gap-1 flex items-center bg-gray-950/90 px-1 py-0.5 rounded-sm"
          :title="`${name} is locked`"
        >
          <UIcon name="i-lucide-lock" />
          {{ name }}
        </span>
      </template>
      <div
        v-for="modifier in card.modifiers"
        :key="modifier.modifier.name"
        class="modifier-icon gap-1 flex items-center bg-gray-950/90 px-1 py-0.5 rounded-sm cursor-pointer"
        :title="modifier.modifier.name"
        @click.stop="emits('showCardModifiers', card)"
      >
        <span :class="['ms', modifier.modifier.symbol]" />
        <span
          v-if="modifier.count > 1"
          class="modifier-icon-count whitespace-nowrap"
        >
          x{{ modifier.count }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMoveAnimation } from '~/features/castAnimation';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import { useElementHover } from '@vueuse/core';
import { useDoubleTap } from '~/composables/useDoubleTap';
import SharedCardText from '~/components/shared/CardText.vue';
import { useSettingsStore } from '~/stores/settings';
import { computed, useTemplateRef } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import {
  doorNames,
  isLandscape,
  shownImageUri,
  showsImage,
} from '~/features/battlefield/cardFaces';
import type { BoardCard } from '~/types/PlayArea';

const props = defineProps<{
  card: BoardCard;
}>();

const emits = defineEmits<{
  showCardDetails: [BoardCard];
  showCardModifiers: [BoardCard];
}>();

const stack = computed(() => props.card.stack);

const battlefield = useBattlefieldStore();
const settings = useSettingsStore();
const animateMove = useMoveAnimation();

const showImage = computed(() =>
  showsImage(props.card, settings.imagesEnabled),
);
const imageUri = computed(() => shownImageUri(props.card));
const lockedNames = computed(() => {
  const names = doorNames(props.card);
  return (props.card.lockedDoors ?? []).map((door) => names[door]!);
});
const lockedDescription = computed(() =>
  lockedNames.value.length
    ? `Locked: ${lockedNames.value.join(', ')}`
    : undefined,
);
const landscape = computed(() => isLandscape(props.card));
// Lies on its long side: a landscape card untapped, or any other card tapped.
const sideways = computed(() => landscape.value !== props.card.tapped);
// Scryfall's images are portrait, with landscape cards printed sideways in
// them, so the image keeps its size and turns a quarter clockwise to read.
const rotation = computed(
  () =>
    (landscape.value ? 90 : 0) +
    (props.card.tapped ? 90 : 0) +
    (props.card.turned ? 180 : 0),
);

const isValidAttachmentTarget = computed(() => {
  return battlefield.isValidAttachmentTarget(props.card);
});

const tryAttach = (ev: Event) => {
  if (!battlefield.isAttaching) return;

  if (!isValidAttachmentTarget.value) return;

  if (!stack.value) return false;

  ev.stopPropagation();
  ev.preventDefault();

  const moving = battlefield.cardToAttachId;
  const play = animateMove(moving ? [moving] : []);
  battlefield.finishAttaching(stack.value);
  play(stack.value.primary.id, true);
};

const cardImageSection = useTemplateRef('cardImageSection');
const isHovered = useElementHover(cardImageSection);
useDoubleTap(cardImageSection, () => emits('showCardDetails', props.card));
</script>

<style lang="css" scoped>
.board-card {
  .card-image-wrapper {
    width: var(--w);
    height: var(--h);
    position: relative;

    /* The outline is drawn by the image, so it turns with the card; the
       wrapper only sets the colour and takes up the space. */
    box-sizing: border-box;
    border-width: 0;

    /* Tap and untap ease rather than snap (#124). */
    transition:
      width 180ms ease-out,
      height 180ms ease-out;

    .card-image {
      width: var(--scaled-short);
      height: var(--scaled-long);

      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(var(--rotate, 0deg));
      transition: transform 180ms ease-out;

      box-sizing: content-box;
      overflow: hidden;
      border: var(--border-width) solid;
      border-color: inherit;
      border-radius: inherit;

      background-origin: padding-box;
      background-color: black;
      background-attachment: local;
      background-repeat: no-repeat;
      background-clip: padding-box;
      background-position: center center;
      background-size: var(--scaled-short) var(--scaled-long);

      .door-lock {
        position: absolute;
        left: 0;
        width: 100%;
        height: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(0 0 0 / 55%);
        pointer-events: none;
      }

      .door-lock-icon {
        width: 30%;
        height: auto;
        aspect-ratio: 1;
        color: white;
        filter: drop-shadow(0 0 0.15em black);
        /* Upright however the card has turned. */
        rotate: calc(var(--rotate, 0deg) * -1);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-image-wrapper,
    .card-image-wrapper .card-image {
      transition: none;
    }
  }

  &.sideways .card-image-wrapper {
    width: var(--h);
    height: var(--w);
  }

  &:hover .modifier-icon {
    background-color: color-mix(
      in oklab,
      var(--color-primary-900) 90%,
      transparent
    );
  }
}

.modifiers {
  position: absolute;
  grid-template-rows: repeat(5, minmax(0, 1fr));
  height: fit-content;
  left: calc(100% + 0.3em);
}

.attachment .modifiers {
  margin-top: calc(var(--h) * 0.58);
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

:not(.attachment) > .sideways + .modifiers {
  top: 17%;
  left: 15%;
  padding-bottom: 60%;
  grid-template-rows: repeat(5, minmax(0, 1fr));
}

.attachment > .sideways + .modifiers {
  padding-top: 45%;
  left: 12%;
  padding-bottom: 60%;
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.modifier-icon > .ms {
  font-size: 1em;
  line-height: 1.3 !important; /* Icons are too tall with the normal line height. */
  padding-left: 1px; /* Icons are a little to the left for some reason. */
}

.modifier-icon-count {
  font-size: 1em;
  line-height: 1 !important;
  padding-top: 2px;
}

.face-number {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 60px;
  line-height: 1;
  background: color-mix(in oklab, var(--fill-bg) 80%, transparent);
  border-radius: var(--radius-xl);
  padding: var(--spacing);
}

.attach-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: color-mix(in oklab, var(--fill-bg) 50%, transparent);
}
</style>
