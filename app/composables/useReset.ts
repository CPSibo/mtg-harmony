import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { useGraveyard } from '~/features/graveyard';

export function useReset() {
  const toast = useToast();

  const battlefield = useBattlefieldStore();
  const settingsStore = useSettingsStore();
  const discordFetchStore = useDiscordFetcherStore();
  const graveyard = useGraveyard();

  function clearBoard() {
    battlefield.reset();

    toast.add({
      title: 'Board cleared',
      color: 'info',
    });
  }

  function clearSession() {
    clearBoard();

    discordFetchStore.reset();
    graveyard.reset();
    // TODO: Clear history
    // TODO: Clear exile

    toast.add({
      title: 'Session cleared',
      color: 'info',
    });
  }

  function resetAppData() {
    clearSession();

    settingsStore.reset();

    toast.add({
      title: 'App data reset',
      color: 'info',
    });
  }

  return {
    clearBoard,
    clearSession,
    resetAppData,
  };
}
