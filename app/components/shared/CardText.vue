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

      <p
        v-if="rules.length"
        class="rules"
        :class="{ long: (face.oracle_text?.length ?? 0) > 220 }"
      >
        <template
          v-for="(part, i) in rules"
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
import { computed } from 'vue';
import type { ScryfallCard, ScryfallCardFace } from '~/types/Scryfall';
import { manaSymbols, rulesText } from '~/utils/manaSymbols';

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
const rules = computed(() => rulesText(face.value.oracle_text));
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
  font-size: 5cqw;
}

.rules {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  font-size: 5.2cqw;
  white-space: pre-line;
}

.rules.long {
  font-size: 4.2cqw;
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
