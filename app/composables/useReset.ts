import { useToast } from '@nuxt/ui/composables';
import { useSettingsStore } from '~/stores/settings';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { useEventLogStore, type GameMarkerReason } from '~/features/eventLog';

/**
 * The menu's three levels of reset, each with one toast. Clear board only
 * clears the board (for board wipes), in the same game. New game also clears
 * On-deck and starts a new game in the event log (one marker). Reset app
 * empties the log too, back to a fresh install.
 */
export function useReset() {
  const toast = useToast();

  const battlefield = useBattlefieldStore();
  const settingsStore = useSettingsStore();
  const discordFetchStore = useDiscordFetcherStore();
  const log = useEventLogStore();

  function clearBoard() {
    battlefield.clearBoard();
    toast.add({ title: 'Board cleared', color: 'info' });
  }

  /** Clears the board and On-deck. The idle prompt passes its own reason. */
  function newGame(reason: GameMarkerReason = 'newGame') {
    battlefield.clearBoard();
    discordFetchStore.reset();
    log.startNewGame(reason);
    toast.add({ title: 'New game', color: 'info' });
  }

  function resetAppData() {
    battlefield.clearBoard();
    discordFetchStore.reset();
    settingsStore.reset();
    log.reset();
    toast.add({ title: 'App reset', color: 'info' });
  }

  return {
    clearBoard,
    newGame,
    resetAppData,
  };
}
