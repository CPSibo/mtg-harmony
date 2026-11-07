import { useToast } from '@nuxt/ui/composables';
import { useSettingsStore } from '~/stores/settings';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';

export function useReset() {
  const toast = useToast();

  const battlefield = useBattlefieldStore();
  const settingsStore = useSettingsStore();
  const discordFetchStore = useDiscordFetcherStore();

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
