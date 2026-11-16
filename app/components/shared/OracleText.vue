<template>
  <div class="flex flex-col gap-3 text-sm">
    <section
      v-for="(face, f) in faces"
      :key="f"
      class="flex flex-col gap-1"
    >
      <h3
        v-if="faces.length > 1"
        class="font-semibold"
      >
        {{ face.name }}
      </h3>
      <span
        v-if="face.type_line"
        class="text-muted"
      >
        {{ face.type_line }}
      </span>
      <p
        v-for="(line, l) in lines(face.oracle_text)"
        :key="l"
      >
        <template
          v-for="(part, i) in line"
          :key="i"
        >
          <i
            v-if="'symbol' in part"
            :class="part.symbol"
            :title="part.label"
          />
          <em v-else-if="part.reminder">{{ part.text }}</em>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
      <span
        v-if="face.power !== undefined && face.toughness !== undefined"
        class="self-end font-semibold"
      >
        {{ face.power }}/{{ face.toughness }}
      </span>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ScryfallCardFace } from '~/types/Scryfall';
import { rulesText, type RulesPart } from '~/utils/manaSymbols';

defineProps<{
  faces: Pick<
    ScryfallCardFace,
    'name' | 'type_line' | 'oracle_text' | 'power' | 'toughness'
  >[];
}>();

// One list of parts per line of the rules text.
function lines(text: string | undefined): RulesPart[][] {
  const result: RulesPart[][] = [[]];
  for (const part of rulesText(text)) {
    if (!('text' in part)) {
      result.at(-1)!.push(part);
      continue;
    }
    part.text.split('\n').forEach((line, i) => {
      if (i > 0) result.push([]);
      if (line) result.at(-1)!.push({ ...part, text: line });
    });
  }
  return result.filter((line) => line.length);
}
</script>

<style scoped>
.ms {
  font-size: 0.9em;
  margin: 0 0.12em;
}
</style>
