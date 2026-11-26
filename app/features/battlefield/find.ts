import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';
import type { ScryfallCard } from '~/types/Scryfall';
import { useSelectionStore } from './selection';
import { useBattlefieldStore } from './store';

/** Whether every word of `query` is in `parts`, ignoring case. */
function hasEveryWord(parts: (string | undefined)[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const text = parts.filter(Boolean).join('\n').toLowerCase();
  return words.every((w) => text.includes(w));
}

/**
 * Whether every word of `query` is in the card's name, type line or text,
 * on any face, ignoring case (#219). A blank query matches nothing.
 */
export function cardMatches(card: ScryfallCard, query: string): boolean {
  const parts = [card.name, card.type_line, card.oracle_text];
  for (const face of card.card_faces ?? [])
    parts.push(face.name, face.type_line, face.oracle_text);
  return hasEveryWord(parts, query);
}

/**
 * Whether every word of `query` is in the card's type line, on any face,
 * ignoring case (#220). A blank query matches nothing.
 */
export function typeLineMatches(card: ScryfallCard, query: string): boolean {
  const faces = card.card_faces ?? [];
  return hasEveryWord(
    [card.type_line, ...faces.map((f) => f.type_line)],
    query,
  );
}

const cardsOf = (stack: BoardCardStack): BoardCard[] => [
  stack.primary,
  ...stack.attachments,
  ...stack.unders,
];

/**
 * Find on board (#219): the stacks with a card matching the query, and which
 * one is current. Board.vue pans to the current one; it's also selected, so
 * selection commands act on it. Not saved.
 */
export const useBoardFind = defineStore('boardFind', () => {
  const battlefield = useBattlefieldStore();
  const selection = useSelectionStore();

  const isOpen = ref(false);
  const query = ref('');
  const index = ref(0);

  /** Matching stacks, top to bottom, then left to right. */
  const matches = computed(() =>
    battlefield.stacks
      .filter((s) =>
        cardsOf(s).some((c) => cardMatches(c.scryfallInfo, query.value)),
      )
      .sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
      ),
  );

  const current = computed<BoardCardStack | null>(() => {
    const n = matches.value.length;
    return n ? matches.value[((index.value % n) + n) % n]! : null;
  });

  /** The current match's place, from 1, or 0 with none. */
  const position = computed(() =>
    current.value ? matches.value.indexOf(current.value) + 1 : 0,
  );

  function setQuery(value: string) {
    query.value = value;
    index.value = 0;
  }

  function next() {
    if (matches.value.length)
      index.value = position.value % matches.value.length;
  }

  function previous() {
    const n = matches.value.length;
    if (n) index.value = (position.value - 2 + n) % n;
  }

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    setQuery('');
  }

  // The current match is selected while finding, so it's the palette's target.
  watch(current, (stack) => {
    if (!isOpen.value || !stack) return;
    selection.clear();
    selection.add(stack.id);
  });

  return {
    isOpen,
    query,
    matches,
    current,
    position,
    setQuery,
    next,
    previous,
    open,
    close,
  };
});
