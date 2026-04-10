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
    const newStack: BoardCardStack = {
      id: uuidv4(),
      primary: card,
      attachments: [],
      unders: [],
      position: { ...center.value },
    };

    card.stack = newStack;

    stacks.value.push(newStack);

    return newStack;
  }

  function removeStack(stack: BoardCardStack) {
    if (!stacks.value.includes(stack)) return false;

    stacks.value = stacks.value.filter((f) => f !== stack);

    return true;
  }

  function cardIsInStack(card: BoardCard, stack: BoardCardStack) {
    if (stack.primary === card) return true;

    if (stack.attachments.includes(card)) return true;

    if (stack.unders.includes(card)) return true;

    return false;
  }

  function getStackByCard(card: BoardCard) {
    return (
      card.stack || stacks.value.find((stack) => cardIsInStack(card, stack))
    );
  }

  function removeCardFromStack(card: BoardCard) {
    const stack = getStackByCard(card);

    if (!stack) return false;

    if (!stacks.value.includes(stack)) return false;

    if (stack.attachments.includes(card)) {
      stack.attachments = stack.attachments.filter((f) => f !== card);

      return true;
    }

    if (stack.unders.includes(card)) {
      stack.unders = stack.unders.filter((f) => f !== card);

      return true;
    }

    if (stack.primary === card) {
      const newStacks = explodeStack(stack);
      removeStack(newStacks.primaryStack);
      return [...newStacks.attachmentStacks, ...newStacks.underStacks];
    }

    throw new Error('Unknown removal operation.');
  }

  function explodeStack(stack: BoardCardStack) {
    const newStacks: {
      primaryStack: BoardCardStack;
      attachmentStacks: BoardCardStack[];
      underStacks: BoardCardStack[];
    } = {
      primaryStack: stack,
      attachmentStacks: [],
      underStacks: [],
    };

    const xSpacing = 200;
    const ySpacing = 240;

    const attachments = stack.attachments;
    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index]!;

      removeCardFromStack(attachment);
      const newStack = addStackByCard(attachment);
      newStack.position = {
        x:
          stack.position.x +
          index * xSpacing -
          (attachments.length - 1) * (xSpacing / 2),
        y: stack.position.y + ySpacing,
      };
      newStacks.attachmentStacks.push(newStack);
    }

    const unders = stack.unders;
    for (let index = 0; index < unders.length; index++) {
      const under = unders[index]!;

      removeCardFromStack(under);
      const newStack = addStackByCard(under);
      newStack.position = {
        x:
          stack.position.x +
          index * xSpacing -
          (attachments.length - 1) * (xSpacing / 2),
        y: stack.position.y + ySpacing * 2,
      };
      newStacks.underStacks.push(newStack);
    }

    return newStacks;
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
    const sourceCard = toValue(cardToAttach);

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

    removeCardFromStack(sourceCard);

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

  function clearStacks() {
    stacks.value = [];
  }

  function reset() {
    clearStacks();
    cancelAttaching();
    setCenter(defaults.center);
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
    reset,

    untapAll,

    stacks,
    setStacks,
    addStackByCard,
    clearStacks,
    removeStack,
    removeCardFromStack,
    explodeStack,
    cardIsInStack,
    getStackByCard,

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
