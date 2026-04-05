import type { BoardCard, BoardCardStack } from '~/types/PlayArea';

const STORAGE_KEY = 'mtg-harmony_graveyard';

export interface Graveyard {
  removeCounters: boolean;
  cards: BoardCard[];
}

const defaults: Graveyard = {
  removeCounters: true,
  cards: [],
};

export const useGraveyard = defineStore('graveyard', () => {
  const removeCounters = ref(defaults.removeCounters);

  const cards = ref<BoardCard[]>(defaults.cards);

  function addCard(card: BoardCard) {
    if (cards.value.includes(card)) return false;

    if(removeCounters)
      card.modifiers = [];

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
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Graveyard>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (typeof data.removeCounters === 'boolean')
      removeCounters.value = data.removeCounters;

    if (Array.isArray(data?.cards)) cards.value = data.cards;

    return true;
  }

  watch(
    [cards, removeCounters],
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
  };
});
