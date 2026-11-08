import { useToast } from '@nuxt/ui/composables';
import { useSettingsStore } from '~/stores/settings';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { useEventLogStore, type GameMarkerReason } from '~/features/eventLog';

/**
 * The menu's three levels of reset, each with one toast. Clear board and
 * clear session start a new game in the event log (one marker); reset all
 * data empties the log, back to a fresh install.
 */
export function useReset() {
  const toast = useToast();

  const battlefield = useBattlefieldStore();
  const settingsStore = useSettingsStore();
  const discordFetchStore = useDiscordFetcherStore();
  const log = useEventLogStore();

  function finish(reason: GameMarkerReason, title: string) {
    log.startNewGame(reason);
    toast.add({ title, color: 'info' });
  }

  function clearBoard() {
    battlefield.clearBoard();
    finish('clearBoard', 'Board cleared');
  }

  /** Clears the board and On-deck. The idle prompt passes its own reason. */
  function clearSession(
    reason: Extract<
      GameMarkerReason,
      'clearSession' | 'idlePrompt'
    > = 'clearSession',
  ) {
    battlefield.clearBoard();
    discordFetchStore.reset();
    finish(reason, reason === 'idlePrompt' ? 'New game' : 'Session cleared');
  }

  function resetAppData() {
    battlefield.clearBoard();
    discordFetchStore.reset();
    settingsStore.reset();
    log.reset();
    toast.add({ title: 'App data reset', color: 'info' });
  }

  return {
    clearBoard,
    clearSession,
    resetAppData,
  };
}
