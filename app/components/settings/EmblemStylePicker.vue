<template>
  <UButton
    color="neutral"
    variant="outline"
    trailing-icon="i-lucide-chevron-right"
    :label="emblemStyleName(settings.boardEmblemStyle)"
    :disabled="!settings.boardBackgroundEnabled"
    aria-haspopup="dialog"
    @click="open = true"
  />

  <UModal
    v-model:open="open"
    title="Emblem style"
    description="How the board background draws each colour's emblem"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div
        role="radiogroup"
        aria-label="Emblem style"
        class="flex flex-col gap-2"
      >
        <button
          v-for="style in rows"
          :key="style.id"
          type="button"
          role="radio"
          :aria-checked="style.id === settings.boardEmblemStyle"
          class="emblem-style flex w-full flex-col gap-2 rounded-md border border-default bg-elevated p-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          @click="pick(style.id)"
        >
          <span class="flex items-center gap-2 font-semibold text-highlighted">
            {{ style.name }}
            <UIcon
              v-if="style.id === settings.boardEmblemStyle"
              name="i-lucide-check"
              class="size-4 text-primary"
            />
          </span>
          <span class="grid w-full grid-cols-6 gap-2 sm:gap-3">
            <img
              v-for="preview in style.previews"
              :key="preview.key"
              :src="preview.src"
              alt=""
              class="aspect-square w-full"
            />
          </span>
        </button>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { computed, ref } from 'vue';
import {
  BOARD_COLORS,
  DARK_PALETTE,
  EMBLEM_STYLES,
  LIGHT_PALETTE,
  emblemPreview,
  emblemStyleName,
  svgDataUri,
  type EmblemStyle,
} from '~/features/boardBackground';
import { useSettingsStore } from '~/stores/settings';

/**
 * The board background's emblem style (#250): a button naming the style,
 * which opens a list of every style with its six emblems. Picking one closes
 * the list.
 */
const settings = useSettingsStore();
const open = ref(false);

// Drawn only while the list is open, in the colours of the theme showing:
// Nuxt UI puts `dark` on <html>.
const rows = computed(() => {
  if (!open.value) return [];
  const palette = document.documentElement.classList.contains('dark')
    ? DARK_PALETTE
    : LIGHT_PALETTE;
  return EMBLEM_STYLES.map(({ id, name }) => ({
    id,
    name,
    previews: BOARD_COLORS.map((key) => ({
      key,
      src: svgDataUri(emblemPreview(id, key, palette)),
    })),
  }));
});

function pick(style: EmblemStyle) {
  settings.setBoardEmblemStyle(style);
  open.value = false;
}
</script>

<style scoped>
.emblem-style[aria-checked='true'] {
  border-color: var(--ui-primary);
}
</style>
