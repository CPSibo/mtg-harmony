import { computed } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { colorsOfCards } from './colors';

/**
 * The colours the board background shows: the picked ones, or, with auto
 * colours on, the sum of the identities of every card on the board, which
 * changes as cards enter or leave. It reads only the stacks and their cards,
 * so moving or tapping a card doesn't recompute it.
 */
export function useBoardColors() {
  const settings = useSettingsStore();
  const battlefield = useBattlefieldStore();
  return computed(() => {
    if (!settings.boardColorsAuto) return settings.boardColors;
    return colorsOfCards(
      battlefield.stacks.flatMap((s) => [
        s.primary,
        ...s.attachments,
        ...s.unders,
      ]),
    );
  });
}
