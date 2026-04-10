import { useGraveyard } from '~/features/graveyard';

export function useReset() {
  const toast = useToast();

  const battlefield = useBattlefield();
  const settingsStore = useSettingsStore();
  const onDeckStore = useOnDeckStore();
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

    onDeckStore.reset();
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
