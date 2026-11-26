<template>
  <UModal
    v-model:open="open"
    :modal="false"
    :content="{
      // Closing after a command mustn't send focus back to the search
      // button: the window the command opened would see focus leave and close.
      onCloseAutoFocus: (e: Event) => e.preventDefault(),
    }"
    :ui="{
      content: 'top-2 translate-none -translate-x-1/2!',
    }"
    @update:open="
      () => {
        searchTerm = '';
      }
    "
  >
    <UButton
      icon="i-lucide-search"
      class="fixed top-[calc(0.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2"
      color="neutral"
      variant="subtle"
      @click="
        () => {
          open = true;
        }
      "
    >
      <template #trailing>
        <UKbd value="/" />
      </template>
    </UButton>

    <template #content>
      <div
        ref="content"
        class="contents"
      >
        <!-- A shorter list, so the board shows below it (#235). -->
        <UCommandPalette
          v-model:search-term="searchTerm"
          :groups="groups"
          :ui="{ viewport: 'max-h-[min(22rem,50svh)]' }"
          @update:model-value="open = false"
        />
      </div>
      <!-- A picked command runs and the palette gets out of its way, so a
           window it opens (like Add Card) isn't left stacked under it. -->
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UKbd from '@nuxt/ui/components/Kbd.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { defineShortcuts } from '@nuxt/ui/composables';
import {
  computed,
  defineAsyncComponent,
  ref,
  useTemplateRef,
  watch,
} from 'vue';
import { useCloseOnTouchOutside } from '~/composables/useCloseOnTouchOutside';
import { useWidgetRegistry } from '~/features/widgets';
import { whenIdle } from '~/utils/whenIdle';

// The palette (with fuse.js and a virtualizer) loads when the browser is
// idle or on first open, so it stays out of the startup bundle.
const loadPalette = () => import('@nuxt/ui/components/CommandPalette.vue');
const UCommandPalette = defineAsyncComponent(loadPalette);
whenIdle(() => void loadPalette());

const open = defineModel<boolean>('open');

defineShortcuts({
  '/': () => {
    open.value = true;
  },
});

const registry = useWidgetRegistry();
const groups = computed(() => registry.paletteGroups);

const searchTerm = ref('');

// The palette's own `$el` can be a text node, so the touch and focus checks
// test against this wrapper (`display: contents`, so layout is unchanged).
const content = useTemplateRef('content');
useCloseOnTouchOutside(open, content);

// Let go of focus as soon as the palette starts closing (#230). Its search box
// stays on screen while it animates out, and a press on the board doesn't take
// focus, so the next "/" went into the box (shortcuts ignore inputs) instead
// of opening the palette again.
watch(open, (isOpen) => {
  const active = document.activeElement;
  if (
    !isOpen &&
    active instanceof HTMLElement &&
    content.value?.contains(active)
  )
    active.blur();
});
</script>
