import type { Battlefield, BoardCard, BoardCardStack } from '~/types/PlayArea';
import { v4 as uuidv4 } from 'uuid';
import type { Position } from '@vueuse/core';

const STORAGE_KEY = 'mtg-harmony_battlefield';

const defaults: Battlefield = {
  stacks: [],
  center: { x: 0, y: 0 },
};

export const useBattlefield = defineStore('battlefield', () => {
  const stacks = ref<BoardCardStack[]>(defaults.stacks);
  function setStacks(value: BoardCardStack[]) {
    stacks.value = value;
  }

  const center = ref<Position>(defaults.center);
  function setCenter(value: Position) {
    center.value = value;
  }

  function addStackByCard(card: BoardCard) {
    const newStack = {
      id: uuidv4(),
      primary: card,
      attachments: [],
      unders: [],
      position: { ...center.value },
      counter: 0,
    };

    card.stack = newStack;

    stacks.value.push(newStack);

    return newStack;
  }

  function untapAll() {
    for (let i = 0; i < stacks.value.length; i++) {
      const stack = stacks.value[i];

      if (!stack) continue;

      stack.primary.tapped = false;

      for (let i = 0; i < stack.attachments.length; i++) {
        const attachment = stack.attachments[i];

        if (!attachment) continue;

        attachment.tapped = false;
      }
    }
  }

  const cardToAttach = ref<BoardCard | null>(null);
  function startAttaching(card: BoardCard) {
    cardToAttach.value = card;
  }

  function cancelAttaching() {
    cardToAttach.value = null;
  }

  function finishAttaching(stack: BoardCardStack) {
    const sourceCard = cardToAttach.value;

    if (!sourceCard) throw new Error('Source card not set.');

    if (sourceCard == stack.primary)
      throw new Error('Cannot attach a card to itself.');

    if (stack.attachments.includes(sourceCard))
      throw new Error(
        'Source card already belongs to target stack as attachment.',
      );

    if (stack.unders.includes(sourceCard))
      throw new Error(
        'Source card already belongs to target stack as an under.',
      );

    const sourceCardHasAStack = !!sourceCard.stack;
    const sourceCardIsSourceStacksPrimary =
      sourceCard === sourceCard.stack?.primary;
    const sourceStackHasAttachments = !!sourceCard.stack?.attachments?.length;

    if (sourceCardIsSourceStacksPrimary) {
      if (sourceStackHasAttachments) {
        // TODO: Split attachments into their own stacks.
      }

      stacks.value = stacks.value.filter((f) => f !== sourceCard.stack);
    }

    stack.attachments.push(sourceCard);
    sourceCard.stack = stack;
    cardToAttach.value = null;
  }

  const isAttaching = computed(() => !!cardToAttach.value);

  function isValidAttadchmentTarget(targetCard: BoardCard) {
    if (!isAttaching.value) return false;

    if (cardToAttach.value === targetCard) return false;

    if (targetCard.stack?.primary === cardToAttach.value) return false;

    if (targetCard.stack?.attachments?.includes(cardToAttach.value!))
      return false;

    if (targetCard.stack?.primary !== targetCard) return false;

    if (targetCard.stack?.unders?.includes(cardToAttach.value!)) return false;

    return true;
  }

  function detach(card: BoardCard) {
    if (card.stack?.primary === card) return;

    if (!card.stack?.attachments.includes(card)) return;

    card.stack.attachments = card.stack.attachments.filter((f) => f !== card);
    card.stack = undefined;
    addStackByCard(card);
  }

  function clear() {
    stacks.value = [];
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      stacks: stacks.value,
      center: center.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Battlefield>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (Array.isArray(data?.stacks)) stacks.value = data.stacks;

    if (typeof data?.center === 'number') center.value = data.center;

    return true;
  }

  watch(
    [stacks, center],
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
    clear,

    untapAll,

    stacks,
    setStacks,
    addStackByCard,

    center,
    setCenter,

    startAttaching,
    cancelAttaching,
    finishAttaching,
    isAttaching,
    isValidAttadchmentTarget,
    detach,
  };
});
