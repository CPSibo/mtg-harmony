import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';

const STORAGE_KEY = 'mtg-harmony_on-deck';

export const useOnDeckStore = defineStore('onDeck', () => {
  const card = ref<BoardCard | null>(null);

  function setCard(scryfallCard: ScryfallCard) {
    card.value = {
      id: scryfallCard.id,
      scryfallInfo: scryfallCard,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      image_uri: pickImageUri(scryfallCard) ?? '',
      scryfall_uri: scryfallCard.scryfall_uri,
      modifiers: [],
      tapped: false,
      faceNumber: 0,
    };
  }

  // function castCard() {
  //   if (!card.value) return

  //   const gridStore = useGridStore()
  //   const historyStore = useHistoryStore()

  //   // Find the most recent uncast history entry matching this card
  //   const historyEntry = historyStore.entries
  //     .slice()
  //     .reverse()
  //     .find(e => e.scryfall_uri === card.value!.scryfall_uri && !e.wasCast)

  //   if (historyEntry) {
  //     historyStore.markCast(historyEntry.id)
  //   }

  //   gridStore.addCard({ ...card.value })
  //   card.value = null
  // }

  function clearCard() {
    card.value = null;
  }

  function reset() {
    clearCard();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, card.value);
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<BoardCard | null>(STORAGE_KEY);
    if (data === null) return false;
    card.value = data;
    return true;
  }

  watch(
    card,
    () => {
      save();
    },
    { deep: true },
  );

  return {
    save,
    load,
    reset,

    card,
    setCard,
    // castCard,
    clearCard,
  };
});
