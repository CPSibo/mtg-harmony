import { defineStore } from 'pinia';
import { ref } from 'vue';
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

  /** What the search covers (#217). Kept for the session, not saved. */
  const categories = ref<SearchCategory[]>([...DEFAULT_CATEGORIES]);

  function toggleCategory(category: SearchCategory) {
    const i = categories.value.indexOf(category);
    if (i === -1) categories.value.push(category);
    else categories.value.splice(i, 1);
  }

  function openAddCardWindow() {
    addCardWindowIsOpen.value = true;
  }

  function closeAddCardWindow() {
    addCardWindowIsOpen.value = false;
  }

  function toggleAddCardWindow() {
    addCardWindowIsOpen.value = !addCardWindowIsOpen.value;
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
    openAddCardWindow,
    closeAddCardWindow,
    toggleAddCardWindow,

    categories,
    toggleCategory,
  };
});
