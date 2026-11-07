import { useLocalStorage } from '~/composables/useLocalStorage';
import { defineStore } from 'pinia';
import { computed, ref, toValue, watch } from 'vue';
import type {
  Battlefield,
  BoardCard,
  BoardCardModifier,
  BoardCardStack,
} from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import { randomUUID } from '~/utils/randomUUID';
import type { Position } from '@vueuse/core';
import { createBoardCard } from './boardCard';

const STORAGE_KEY = 'mtg-harmony_battlefield';

/** Fresh default state. A factory, so no store shares (and mutates) it. */
function createDefaults(): Battlefield {
  return {
    stacks: [],
    zOrder: [],
    center: { x: 0, y: 0 },
    snapScale: 10,
  };
}

/**
 * Makes every saved card a separate object with its own ID. Boards saved
 * before #23 used the Scryfall ID as the card ID, and casting the same
 * On-deck card twice put one object on two stacks.
 */
function repairCardIds(stacks: BoardCardStack[]) {
  const seenIds = new Set<string>();
  const seenCards = new Set<BoardCard>();

  function repair(card: BoardCard, stack: BoardCardStack): BoardCard {
    if (seenCards.has(card)) {
      card = { ...card, modifiers: new Set(card.modifiers), id: randomUUID() };
    }
    if (card.id === card.scryfallInfo?.id || seenIds.has(card.id)) {
      card.id = randomUUID();
    }
    card.stack = stack;
    seenCards.add(card);
    seenIds.add(card.id);
    return card;
  }

  for (const stack of stacks) {
    stack.primary = repair(stack.primary, stack);
    stack.attachments = new Set(
      [...stack.attachments].map((c) => repair(c, stack)),
    );
    stack.unders = new Set([...stack.unders].map((c) => repair(c, stack)));
  }
}

export const useBattlefieldStore = defineStore('battlefield', () => {
  const defaults = createDefaults();

  const stacks = ref<BoardCardStack[]>(defaults.stacks);
  function setStacks(value: BoardCardStack[]) {
    stacks.value = value;
  }

  // MRU order of the stacks for display purposes.
  const zOrder = ref<string[]>(defaults.zOrder);

  function bringToFront(stack: BoardCardStack) {
    const idx = zOrder.value.indexOf(stack.id);

    if (idx === zOrder.value.length - 1) return; // Already front.

    if (idx !== -1) zOrder.value.splice(idx, 1);

    zOrder.value.push(stack.id);
  }

  function reconcileZOrder() {
    const validIds = new Set(stacks.value.map((s) => s.id));

    // Drop ids for stacks that no longer exist.
    if (zOrder.value.some((id) => !validIds.has(id))) {
      zOrder.value = zOrder.value.filter((id) => validIds.has(id));
    }

    // Append any stacks missing from the order.
    for (const stack of stacks.value) {
      if (!zOrder.value.includes(stack.id)) {
        zOrder.value.push(stack.id);
      }
    }
  }

  const orderedStacks = computed(() => {
    const orderIndex = new Map(zOrder.value.map((id, i) => [id, i]));

    // .sort() on a copy. Never touches stacks.value itself.
    return [...stacks.value].sort(
      (a, b) => (orderIndex.get(a.id) ?? -1) - (orderIndex.get(b.id) ?? -1),
    );
  });

  const center = ref<Position>(defaults.center);
  function setCenter(value: Position) {
    center.value = value;
  }

  const snapScale = ref<number>(defaults.snapScale);
  function setsnapScale(value: number) {
    snapScale.value = value;
  }

  function addStackByCard(card: BoardCard) {
    const newStack: BoardCardStack = {
      id: randomUUID(),
      primary: card,
      attachments: new Set<BoardCard>(),
      unders: new Set<BoardCard>(),
      position: { ...center.value },
    };

    card.stack = newStack;

    stacks.value.push(newStack);
    zOrder.value.push(newStack.id);

    return newStack;
  }

  /** Puts a new instance of a Scryfall card on the board in its own stack. */
  function castCard(scryfallCard: ScryfallCard) {
    return addStackByCard(createBoardCard(scryfallCard));
  }

  function removeStack(stack: BoardCardStack) {
    if (!stacks.value.includes(stack)) return false;

    stacks.value = stacks.value.filter((f) => f !== stack);

    const idx = zOrder.value.indexOf(stack.id);
    if (idx !== -1) zOrder.value.splice(idx, 1);

    return true;
  }

  function cardIsInStack(card: BoardCard, stack: BoardCardStack) {
    if (stack.primary === card) return true;

    if (stack.attachments.has(card)) return true;

    if (stack.unders.has(card)) return true;

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

    if (stack.attachments.has(card)) {
      stack.attachments.delete(card);

      return true;
    }

    if (stack.unders.has(card)) {
      stack.unders.delete(card);

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

    const attachments = Array.from(stack.attachments);
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

    const unders = Array.from(stack.unders);
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

      for (const attachment of stack.attachments) {
        attachment.tapped = false;
      }
    }
  }

  /** Moves a stack to a new board position. */
  function setStackPosition(stack: BoardCardStack, position: Position) {
    stack.position = position;
  }

  /** Flips a card between tapped and untapped. */
  function toggleTapped(card: BoardCard) {
    card.tapped = !card.tapped;
  }

  /** Sets the number shown on a card's face (0 hides it). */
  function setFaceNumber(card: BoardCard, value: number) {
    card.faceNumber = value;
  }

  /** Removes every counter and granted keyword from a card. */
  function clearModifiers(card: BoardCard) {
    card.modifiers = new Set<BoardCardModifier>();
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

    if (stack.attachments.has(sourceCard))
      throw new Error(
        'Source card already belongs to target stack as attachment.',
      );

    if (stack.unders.has(sourceCard))
      throw new Error(
        'Source card already belongs to target stack as an under.',
      );

    removeCardFromStack(sourceCard);

    stack.attachments.add(sourceCard);
    sourceCard.stack = stack;

    cardToAttach.value = null;
  }

  const isAttaching = computed(() => !!cardToAttach.value);

  function isValidAttadchmentTarget(targetCard: BoardCard) {
    if (!isAttaching.value) return false;

    if (cardToAttach.value === targetCard) return false;

    if (targetCard.stack?.primary === cardToAttach.value) return false;

    if (targetCard.stack?.attachments?.has(cardToAttach.value!)) return false;

    if (targetCard.stack?.primary !== targetCard) return false;

    if (targetCard.stack?.unders?.has(cardToAttach.value!)) return false;

    return true;
  }

  function detach(card: BoardCard) {
    if (card.stack?.primary === card) return;

    if (!card.stack?.attachments.has(card)) return;

    card.stack.attachments.delete(card);
    card.stack = undefined;
    addStackByCard(card);
  }

  function clearStacks() {
    stacks.value = [];
    zOrder.value = [];
  }

  function reset() {
    clearStacks();
    cancelAttaching();

    const fresh = createDefaults();
    snapScale.value = fresh.snapScale;
    setCenter(fresh.center);
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      stacks: stacks.value,
      zOrder: zOrder.value,
      center: center.value,
      snapScale: snapScale.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<Battlefield>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (Array.isArray(data?.stacks)) {
      repairCardIds(data.stacks);
      stacks.value = data.stacks;
    }

    if (Array.isArray(data?.zOrder)) zOrder.value = data.zOrder;

    reconcileZOrder();

    if (typeof data?.center === 'object') center.value = data.center;

    if (typeof data.snapScale === 'number') snapScale.value = data.snapScale;

    return true;
  }

  load();

  watch(
    [stacks, center, snapScale, zOrder],
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

    snapScale,
    setsnapScale,

    untapAll,
    toggleTapped,
    setFaceNumber,
    clearModifiers,

    stacks,
    bringToFront,
    setStackPosition,
    orderedStacks,
    setStacks,
    addStackByCard,
    castCard,
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
