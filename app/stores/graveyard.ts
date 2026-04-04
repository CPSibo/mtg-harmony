import type { BoardCard } from '~/types/PlayArea';

const STORAGE_KEY = 'mtg-harmony_graveyard';

export interface Graveyard {
  cards: BoardCard[];
}

export const useGraveyard = defineStore('graveyard', () => {
  const cards = ref<BoardCard[]>([]);

  function addCard(card: BoardCard) {
    if (cards.value.includes(card)) return false;

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
    removeAllCards();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      cards: cards.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Graveyard>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (Array.isArray(data?.cards)) cards.value = data.cards;

    return true;
  }

  watch(
    [cards],
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

    addCard,
    removeCard,
    removeAllCards,
  };
});
