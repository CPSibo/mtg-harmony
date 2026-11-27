import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { typeLineMatches } from './find';
import { useSelectionStore } from './selection';
import { useBattlefieldStore } from './store';

/**
 * Select by type (#220): the player types a type, such as "Goblin" or
 * "creature", and the stacks whose card has it on its type line are selected
 * as they type. Done keeps that selection; Cancel puts back the one before.
 * Not saved.
 */
export const useSelectByType = defineStore('selectByType', () => {
  const battlefield = useBattlefieldStore();
  const selection = useSelectionStore();

  const isOpen = ref(false);
  const query = ref('');
  /** The selection when the bar opened, for Cancel. */
  let before: readonly string[] = [];

  const matches = computed(() =>
    battlefield.stacks.filter((s) =>
      typeLineMatches(s.primary.scryfallInfo, query.value),
    ),
  );

  function setQuery(value: string) {
    query.value = value;
    selection.replace(new Set(matches.value.map((s) => s.id)));
  }

  function open() {
    if (!isOpen.value) before = [...selection.ids()];
    isOpen.value = true;
  }

  function done() {
    isOpen.value = false;
    query.value = '';
  }

  function cancel() {
    selection.replace(new Set(before));
    done();
  }

  return { isOpen, query, matches, setQuery, open, done, cancel };
});
