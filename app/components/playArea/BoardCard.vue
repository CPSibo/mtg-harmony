<template>
  <div
    ref="boardCard"
    :data-card-id="card.id"
    class="board-card origin-top-left flex gap-1"
    :class="{ tapped: card.tapped }"
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
        :style="
          settings.imagesEnabled
            ? { backgroundImage: `url('${card.image_uri}')` }
            : undefined
        "
        title="Double tap to open"
        @dblclick="emits('showCardDetails', card)"
        @click="tryAttach"
        @touchend="tryAttach"
      >
        <SharedCardText
          v-if="!settings.imagesEnabled"
          :card="card.scryfallInfo"
          class="size-full"
        />

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
import SharedCardText from '~/components/shared/CardText.vue';
import { useSettingsStore } from '~/stores/settings';
import { computed, useTemplateRef } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
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
</script>

<style lang="css" scoped>
.board-card {
  .card-image-wrapper {
    width: var(--w);
    height: var(--h);
    position: relative;

    box-sizing: border-box;
    overflow: hidden;

    border-width: 2px;
    border-style: solid;

    .card-image {
      width: var(--scaled-short);
      height: var(--scaled-long);

      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(0deg);

      background-origin: center;
      background-color: black;
      background-attachment: local;
      background-repeat: no-repeat;
      background-clip: border-box;
      background-position: center center;
      background-size: var(--scaled-short) var(--scaled-long);
    }
  }

  &.tapped {
    .card-image-wrapper {
      width: var(--h);
      height: var(--w);

      .card-image {
        transform: translate(-50%, -50%) rotate(90deg);
      }
    }
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

:not(.attachment) > .tapped + .modifiers {
  top: 17%;
  left: 15%;
  padding-bottom: 60%;
  grid-template-rows: repeat(5, minmax(0, 1fr));
}

.attachment > .tapped + .modifiers {
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
