import type { Position } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { AddCardState } from '.';
import type { SearchCategory } from './searchQuery';

const DEFAULT_CATEGORIES: readonly SearchCategory[] = ['regular'];

const defaults: AddCardState = {
  /**********************
    State
  **********************/
  addCardWindowIsOpen: false,
};

export const useAddCard = defineStore('addCard', () => {
  const addCardWindowIsOpen = ref<boolean>(defaults.addCardWindowIsOpen);

  /**
   * The board point a card found goes to, when the window was opened from
   * the board menu (#244); otherwise a free spot in view. Kept only while
   * the window is open.
   */
  const target = ref<Position | null>(null);
  // Sync: the window also closes through its v-model (Esc, a tap outside).
  watch(
    addCardWindowIsOpen,
    (open) => {
      if (!open) target.value = null;
    },
    { flush: 'sync' },
  );

  /** What the search covers (#217). Kept for the session, not saved. */
  const categories = ref<SearchCategory[]>([...DEFAULT_CATEGORIES]);

  function toggleCategory(category: SearchCategory) {
    const i = categories.value.indexOf(category);
    if (i === -1) categories.value.push(category);
    else categories.value.splice(i, 1);
  }

  /** Opens the window, aimed at a board point or at none. */
  function openAddCardWindow(at?: Position) {
    target.value = at ?? null;
    addCardWindowIsOpen.value = true;
  }

  function closeAddCardWindow() {
    addCardWindowIsOpen.value = false;
  }

  function toggleAddCardWindow() {
    if (addCardWindowIsOpen.value) closeAddCardWindow();
    else openAddCardWindow();
  }

  function reset() {
    categories.value = [...DEFAULT_CATEGORIES];
  }

  function save() {
    // Empty.
  }

  function load(): boolean {
    // Empty.
    return true;
  }

  load();

  return {
    save,
    load,
    reset,

    addCardWindowIsOpen,
    target,
    openAddCardWindow,
    closeAddCardWindow,
    toggleAddCardWindow,

    categories,
    toggleCategory,
  };
});
