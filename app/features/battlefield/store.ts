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
import type { ElementSize, Position } from '@vueuse/core';
import { useEventLogStore } from '~/features/eventLog';
import { copyBoardCard, createBoardCard } from './boardCard';
import { findFreeSpot, type Rect } from './placement';

/** How much of a card `copyCard` copies. */
export type CopyMode = 'card' | 'counters' | 'stack';

/** Whether a card being placed goes on a stack as an attachment or under. */
export type AttachMode = 'attach' | 'under';

/** How far below its old stack a taken-out under lands, in board pixels. */
const UNDER_TAKE_OUT_OFFSET = 240;

/** How far a copy sits from its source, in board pixels. */
const COPY_OFFSET = 40;

const STORAGE_KEY = 'mtg-harmony_battlefield';

/**
 * A lone untapped card's stack, actions column included, in board pixels.
 * Used for a stack the board hasn't measured yet.
 */
const NEW_STACK_SIZE: ElementSize = { width: 210, height: 250 };

/**
 * The action buttons' column left of a stack's card, in board pixels. Mirrors
 * `--actions-total-width` (1.8em) in BoardCardStack.vue. Placement doesn't
 * count it when checking how much of a new card shows.
 */
const STACK_ACTIONS_WIDTH = 29;

/** Fresh default state. A factory, so no store shares (and mutates) it. */
function createDefaults(): Battlefield {
  return {
    stacks: [],
    zOrder: [],
    center: { x: 0, y: 0 },
    snapScale: 10,
  };
}

export const useBattlefieldStore = defineStore('battlefield', () => {
  const defaults = createDefaults();
  const log = useEventLogStore();

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

  /** What the board shows, in board pixels. Set by the board; not saved. */
  const view = ref<Rect | null>(null);
  function setView(value: Rect) {
    view.value = value;
  }

  /** The board's pan (screen px) and zoom. Set by the board; not saved. */
  const transform = ref<(Position & { scale: number }) | null>(null);
  function setTransform(value: Position & { scale: number }) {
    transform.value = value;
  }

  /** The board point under a screen point, or null before the board is up. */
  function boardPointFromScreen(point: Position): Position | null {
    const t = transform.value;
    if (!t) return null;
    return { x: (point.x - t.x) / t.scale, y: (point.y - t.y) / t.scale };
  }

  /** Each stack's rendered size, reported by the board. Not saved. */
  const stackSizes = ref(new Map<string, ElementSize>());
  function setStackSize(id: string, size: ElementSize) {
    stackSizes.value.set(id, size);
  }
  function forgetStackSize(id: string) {
    stackSizes.value.delete(id);
  }
  function stackSize(stack: BoardCardStack): ElementSize {
    return stackSizes.value.get(stack.id) ?? NEW_STACK_SIZE;
  }

  /**
   * Where a new stack goes: a free spot in view, spiralling out from the
   * middle (`findFreeSpot`). Before the board reports a view, the saved
   * centre.
   */
  function newStackPosition(): Position {
    const shown = view.value;
    if (!shown) return { ...center.value };

    const occupied = stacks.value.map((s) => ({
      ...s.position,
      ...stackSize(s),
    }));
    return findFreeSpot(shown, occupied, NEW_STACK_SIZE, STACK_ACTIONS_WIDTH);
  }

  const snapScale = ref<number>(defaults.snapScale);
  function setSnapScale(value: number) {
    snapScale.value = value;
  }

  function addStackByCard(card: BoardCard, position = center.value) {
    const newStack: BoardCardStack = {
      id: randomUUID(),
      primary: card,
      attachments: new Set<BoardCard>(),
      unders: new Set<BoardCard>(),
      position: { ...position },
    };

    card.stack = newStack;

    stacks.value.push(newStack);
    zOrder.value.push(newStack.id);

    return newStack;
  }

  /**
   * Puts a new instance of a Scryfall card on the board in its own stack and
   * logs it: `cast` from On-deck, `added` through Add Card. With `at` (a
   * board point, say where it was dropped, #79) the card is centred there;
   * otherwise it goes in a free spot in view (#78).
   */
  function castCard(
    scryfallCard: ScryfallCard,
    how: 'cast' | 'added' = 'cast',
    at?: Position,
  ) {
    const position = at
      ? {
          x:
            at.x -
            STACK_ACTIONS_WIDTH -
            (NEW_STACK_SIZE.width - STACK_ACTIONS_WIDTH) / 2,
          y: at.y - NEW_STACK_SIZE.height / 2,
        }
      : newStackPosition();
    const stack = addStackByCard(createBoardCard(scryfallCard), position);
    log.record(how, { card: stack.primary });
    return stack;
  }

  /** Takes a card off the board and logs it. Its stack-mates stay. */
  function removeCard(card: BoardCard) {
    log.record('removed', { card });
    return removeCardFromStack(card);
  }

  /** Empties the board and logs it. */
  function clearBoard() {
    log.record('boardCleared', {});
    reset();
  }

  /**
   * Puts a copy on the board in its own stack, offset from the source and in
   * front. `card` copies the card fresh, `counters` with its own state, and
   * `stack` the card's whole stack (primary, attachments and unders, each with
   * its state). Every copied card gets a new ID.
   */
  function copyCard(card: BoardCard, mode: CopyMode) {
    const source = card.stack;
    const whole = mode === 'stack' && source;
    const origin = source?.position ?? center.value;
    const primary = copyBoardCard(
      whole ? source.primary : card,
      mode !== 'card',
    );
    const copy: BoardCardStack = {
      id: randomUUID(),
      primary,
      attachments: new Set<BoardCard>(),
      unders: new Set<BoardCard>(),
      position: { x: origin.x + COPY_OFFSET, y: origin.y + COPY_OFFSET },
    };
    primary.stack = copy;

    if (whole) {
      for (const [from, to] of [
        [source.attachments, copy.attachments],
        [source.unders, copy.unders],
      ] as const) {
        for (const c of from) {
          const cardCopy = copyBoardCard(c, true);
          cardCopy.stack = copy;
          to.add(cardCopy);
        }
      }
    }

    // Add it only once complete, and return the store's reactive copy.
    stacks.value.push(copy);
    zOrder.value.push(copy.id);
    log.record('copied', { card: primary, source: card, mode });
    return stacks.value.at(-1)!;
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
          (unders.length - 1) * (xSpacing / 2),
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
  /** Whether the card being placed goes on as an attachment or under. */
  const attachMode = ref<AttachMode>('attach');

  /** Starts placing `card` on a stack: attached to it, or under it. */
  function startAttaching(card: BoardCard, mode: AttachMode = 'attach') {
    cardToAttach.value = card;
    attachMode.value = mode;
  }

  function cancelAttaching() {
    cardToAttach.value = null;
  }

  /** The set the card being placed would join on `stack`. */
  function targetSet(stack: BoardCardStack) {
    return attachMode.value === 'under' ? stack.unders : stack.attachments;
  }

  function finishAttaching(stack: BoardCardStack) {
    const sourceCard = toValue(cardToAttach);

    if (!sourceCard) throw new Error('Source card not set.');

    if (sourceCard == stack.primary)
      throw new Error('Cannot attach a card to itself.');

    if (targetSet(stack).has(sourceCard))
      throw new Error(
        `Source card already belongs to target stack as ${
          attachMode.value === 'under' ? 'an under' : 'attachment'
        }.`,
      );

    removeCardFromStack(sourceCard);

    targetSet(stack).add(sourceCard);
    sourceCard.stack = stack;

    if (attachMode.value === 'under')
      log.record('putUnder', { card: sourceCard, target: stack.primary });
    else log.record('attached', { card: sourceCard, target: stack.primary });

    cardToAttach.value = null;
  }

  const isAttaching = computed(() => !!cardToAttach.value);

  function isValidAttachmentTarget(targetCard: BoardCard) {
    if (!isAttaching.value) return false;

    const stack = targetCard.stack;
    if (!stack || stack.primary !== targetCard) return false;

    if (cardToAttach.value === targetCard) return false;

    // Moving between attachments and unders of the same stack is fine.
    if (targetSet(stack).has(cardToAttach.value!)) return false;

    return true;
  }

  /**
   * Takes an attachment or under off its stack into a stack of its own. An
   * under lands just below its old stack; an attachment at the board centre.
   */
  function detach(card: BoardCard) {
    const stack = card.stack;
    if (!stack || stack.primary === card) return;

    if (stack.attachments.delete(card)) {
      card.stack = undefined;
      addStackByCard(card);
    } else if (stack.unders.delete(card)) {
      card.stack = undefined;
      addStackByCard(card);
      // Through the store, so the position change is reactive.
      stacks.value.at(-1)!.position = {
        x: stack.position.x,
        y: stack.position.y + UNDER_TAKE_OUT_OFFSET,
      };
    }
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

    if (Array.isArray(data?.stacks)) stacks.value = data.stacks;

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
    setSnapScale,

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
    setView,
    setTransform,
    boardPointFromScreen,
    transform,
    stackActionsWidth: STACK_ACTIONS_WIDTH,
    setStackSize,
    forgetStackSize,
    stackSize,
    removeCard,
    clearBoard,
    copyCard,
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
    attachMode,
    isValidAttachmentTarget,
    detach,
  };
});
