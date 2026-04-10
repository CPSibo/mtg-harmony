import type { BoardCard } from '~/types/PlayArea';
import type { GraveyardState } from '.';

const STORAGE_KEY = 'mtg-harmony_graveyard';

const defaults: GraveyardState = {
  /**********************
    State
  **********************/
  cards: [],

  graveyardWindowButtonIsVisible: true,
  graveyardWindowIsOpen: false,

  addCardToGraveyardWindowIsOpen: false,

  /**********************
    Settings
  **********************/
  removeCounters: true,
};

export const useGraveyard = defineStore('graveyard', () => {
  const removeCounters = ref<boolean>(defaults.removeCounters);

  const graveyardWindowButtonIsVisible = ref<boolean>(
    defaults.graveyardWindowButtonIsVisible,
  );

  const graveyardWindowIsOpen = ref<boolean>(defaults.graveyardWindowIsOpen);

  function openGraveyardWindow() {
    graveyardWindowIsOpen.value = true;
  }

  function closeGraveyardWindow() {
    graveyardWindowIsOpen.value = false;
  }

  function toggleGraveyardWindow() {
    graveyardWindowIsOpen.value = !graveyardWindowIsOpen.value;
  }

  const addCardToGraveyardWindowIsOpen = ref<boolean>(
    defaults.addCardToGraveyardWindowIsOpen,
  );

  const cards = ref<BoardCard[]>(defaults.cards);

  function openAddCardToGraveyardWindow() {
    addCardToGraveyardWindowIsOpen.value = true;
  }

  function closeAddCardToGraveyardWindow() {
    addCardToGraveyardWindowIsOpen.value = false;
  }

  function toggleAddCardToGraveyardWindow() {
    addCardToGraveyardWindowIsOpen.value =
      !addCardToGraveyardWindowIsOpen.value;
  }

  function addCard(card: BoardCard) {
    if (cards.value.includes(card)) return false;

    if (removeCounters) card.modifiers = [];

    card.tapped = false;
    card.stack = undefined;

    cards.value.push(card);

    return true;
  }

  function removeCard(card: BoardCard) {
    if (!cards.value.includes(card)) return false;

    cards.value = cards.value.filter((f) => f !== card);

    return true;
  }

  function removeAllCards() {
    cards.value = [];
  }

  function reset() {
    removeCounters.value = defaults.removeCounters;
    removeAllCards();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      cards: cards.value,
      removeCounters: removeCounters.value,

      graveyardWindowButtonIsVisible: graveyardWindowButtonIsVisible.value,
      graveyardWindowIsOpen: graveyardWindowIsOpen.value,

      addCardToGraveyardWindowIsOpen: addCardToGraveyardWindowIsOpen.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<GraveyardState>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (typeof data.removeCounters === 'boolean')
      removeCounters.value = data.removeCounters;

    if (Array.isArray(data?.cards)) cards.value = data.cards;

    if (typeof data.graveyardWindowButtonIsVisible === 'boolean')
      graveyardWindowButtonIsVisible.value =
        data.graveyardWindowButtonIsVisible;

    if (typeof data.graveyardWindowIsOpen === 'boolean')
      graveyardWindowIsOpen.value = data.graveyardWindowIsOpen;

    if (typeof data.addCardToGraveyardWindowIsOpen === 'boolean')
      addCardToGraveyardWindowIsOpen.value =
        data.addCardToGraveyardWindowIsOpen;

    return true;
  }

  watch(
    [
      cards,
      removeCounters,
      graveyardWindowButtonIsVisible,
      graveyardWindowIsOpen,
      addCardToGraveyardWindowIsOpen,
    ],
    () => {
      save();
    },
    {
      deep: true,
    },
  );

  return {
    save,
    load,
    reset,

    removeCounters,

    cards,
    addCard,
    removeCard,
    removeAllCards,

    graveyardWindowButtonIsVisible,
    graveyardWindowIsOpen,
    openGraveyardWindow,
    closeGraveyardWindow,
    toggleGraveyardWindow,

    addCardToGraveyardWindowIsOpen,
    openAddCardToGraveyardWindow,
    closeAddCardToGraveyardWindow,
    toggleAddCardToGraveyardWindow,
  };
});
