import type { AddCardState } from '.';

const defaults: AddCardState = {
  /**********************
    State
  **********************/
  addCardWindowIsOpen: false,
};

export const useAddCard = defineStore('addCard', () => {
  const addCardWindowIsOpen = ref<boolean>(defaults.addCardWindowIsOpen);

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
    // Empty.
  }

  function save() {
    // Empty.
  }

  function load(): boolean {
    // Empty.
    return true;
  }

  return {
    save,
    load,
    reset,

    addCardWindowIsOpen,
    openAddCardWindow,
    closeAddCardWindow,
    toggleAddCardWindow,
  };
});
