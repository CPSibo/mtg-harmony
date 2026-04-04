<template>
  <div
    ref="boardCard"
    class="board-card origin-top-left flex gap-1"
  >
    <div
      ref="cardImageSection"
      class="cursor-pointer"
      :class="{ tapped: card.tapped }"
      title="Double tap to open"
      @dblclick="emits('showCardDetails', card)"
      @click="tryAttach"
    >
      <img
        :src="card.image_uri"
        class="mtg-card-display"
        :alt="card.name"
      />

      <!-- TODO: -->
      <!-- <div class="counter" v-if="!!stack.counter">
        {{ stack.counter }}
      </div> -->

      <div
        v-if="battlefield.isAttaching && isHovered && isValidAttachmentTarget"
        class="attach-overlay text-5xl"
      >
        <UIcon
          name="i-lucide-link"
          class="text-primary"
        />
      </div>
    </div>
    <div class="modifiers grid grid-flow-col gap-1 place-items-start">
      <div
        v-for="modifier in card.modifiers.filter((f) => f.count > 0)"
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
import type { BoardCard } from '~/types/PlayArea';

const props = defineProps<{
  card: BoardCard;
}>();

const emits = defineEmits<{
  showCardDetails: [BoardCard];
  showCardModifiers: [BoardCard];
}>();

const stack = computed(() => props.card.stack);

const battlefield = useBattlefield();

const isValidAttachmentTarget = computed(() => {
  return battlefield.isValidAttadchmentTarget(props.card);
});

const tryAttach = (ev: MouseEvent) => {
  if (!battlefield.isAttaching) return;

  if (!isValidAttachmentTarget.value) return;

  if (!stack.value) return false;

  ev.stopPropagation();
  ev.preventDefault();

  battlefield.finishAttaching(stack.value);
};

const cardImageSection = useTemplateRef('cardImageSection');
const isHovered = useElementHover(cardImageSection);
</script>

<style lang="css" scoped>
.board-card {
  width: auto;
  height: 226px;

  .tapped {
    transform: rotate(90deg);
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
  position: relative;
  grid-template-rows: repeat(5, minmax(0, 1fr));
  height: fit-content;
}

.attachment .modifiers {
  padding-top: 45%;
  padding-bottom: 10px;
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

.counter {
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
