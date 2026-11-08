<template>
  <!-- A card as text, for when card images are off (#42). Callers that
       stand it in for an image give it role="img" and a label. It keeps a
       card's shape and scales its text with its own size, so it reads the
       same on the board, in On-deck and in card details. -->
  <div class="card-text bg-elevated text-highlighted border border-default">
    <div class="content">
      <div class="header">
        <span class="name">{{ card.name }}</span>
        <span
          v-if="cost.length"
          class="cost"
        >
          <template
            v-for="(part, i) in cost"
            :key="i"
          >
            <i
              v-if="'symbol' in part"
              :class="part.symbol"
              :title="part.label"
            />
            <span v-else>{{ part.text }}</span>
          </template>
        </span>
      </div>

      <span
        v-if="face.type_line"
        class="type text-muted"
      >
        {{ face.type_line }}
      </span>

      <div
        v-if="paragraphs.length"
        ref="rulesEl"
        class="rules"
      >
        <template
          v-for="(paragraph, p) in paragraphs"
          :key="p"
        >
          <span
            v-if="p > 0"
            class="paragraph-gap"
          />
          <p>
            <template
              v-for="(part, i) in paragraph"
              :key="i"
            >
              <i
                v-if="'symbol' in part"
                :class="[part.symbol, { reminder: part.reminder }]"
                :title="part.label"
              />
              <em
                v-else-if="part.reminder"
                class="reminder"
                >{{ part.text }}</em
              >
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </template>
      </div>

      <span
        v-if="face.power !== undefined && face.toughness !== undefined"
        class="pt"
      >
        {{ face.power }}/{{ face.toughness }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core';
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import type { ScryfallCard, ScryfallCardFace } from '~/types/Scryfall';
import { manaSymbols, rulesText, type RulesPart } from '~/utils/manaSymbols';

const props = defineProps<{
  card: Pick<
    ScryfallCard,
    | 'name'
    | 'mana_cost'
    | 'type_line'
    | 'oracle_text'
    | 'power'
    | 'toughness'
    | 'card_faces'
  >;
}>();

// A multi-face card keeps its rules text on its faces: show the front.
const face = computed<Omit<ScryfallCardFace, 'name'>>(() => {
  const front = props.card.card_faces?.[0];
  return {
    mana_cost: props.card.mana_cost || front?.mana_cost,
    type_line: props.card.type_line ?? front?.type_line,
    oracle_text: props.card.oracle_text ?? front?.oracle_text,
    power: props.card.power ?? front?.power,
    toughness: props.card.toughness ?? front?.toughness,
  };
});

const cost = computed(() => manaSymbols(face.value.mana_cost));
// One list of parts per paragraph (line) of the rules text.
const paragraphs = computed(() => {
  const result: RulesPart[][] = [[]];
  for (const part of rulesText(face.value.oracle_text)) {
    if (!('text' in part)) {
      result.at(-1)!.push(part);
      continue;
    }
    part.text.split('\n').forEach((text, i) => {
      if (i > 0) result.push([]);
      if (text) result.at(-1)!.push({ ...part, text });
    });
  }
  return result.filter((paragraph) => paragraph.length);
});

// Long rules text shrinks only as far as it needs to fit: first the gaps
// between paragraphs give way (in CSS), then the type, a step at a time.
const FIT_STEP = 0.04;
const MIN_FIT = 0.5;
const rulesEl = useTemplateRef<HTMLElement>('rulesEl');

function fit() {
  const el = rulesEl.value;
  if (!el) return;
  el.style.removeProperty('--fit');
  if (!el.clientHeight) return; // Not laid out yet.
  let scale = 1;
  while (el.scrollHeight > el.clientHeight + 1 && scale > MIN_FIT) {
    scale = Math.max(MIN_FIT, scale - FIT_STEP);
    el.style.setProperty('--fit', String(scale));
  }
}

watch(paragraphs, () => nextTick(fit), { flush: 'post' });
// Sizes scale with the card, so the fit only changes when it first gets a
// size, or the font arrives.
useResizeObserver(rulesEl, fit);
document.fonts?.ready.then(fit);
</script>

<style scoped>
.card-text {
  aspect-ratio: 12 / 17;
  border-radius: 4.5% / 3.2%;
  overflow: hidden;
  /* Sizes below are shares of the card's width (cqw). */
  container-type: inline-size;
}

.content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2.5cqw;
  padding: 5cqw;
  font-size: 6cqw;
  line-height: 1.2;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  column-gap: 3cqw;
  row-gap: 1cqw;
}

.name {
  flex: 1 1 50%;
  font-weight: 600;
  font-size: 7.5cqw;
  overflow-wrap: anywhere;
}

/* A long cost wraps onto its own line, right-aligned, rather than squeezing
   the name. */
.cost {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.8cqw;
  font-size: 6cqw;
}

.type {
  font-size: 6.5cqw;
}

.rules {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: calc(7cqw * var(--fit, 1));
}

.rules p {
  flex-shrink: 0;
}

/* Half a line between paragraphs, as on paper, that gives way to nothing
   when the text needs the room. */
.paragraph-gap {
  flex: 0 1 0.6em;
}

.rules .ms {
  font-size: 0.9em;
  margin: 0 0.12em;
}

.reminder {
  font-style: italic;
}

.pt {
  align-self: flex-end;
  font-weight: 600;
  font-size: 7cqw;
}
</style>
