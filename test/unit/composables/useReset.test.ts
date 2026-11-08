import { describe, expect, it, vi } from 'vitest';
import { useReset } from '~/composables/useReset';
import { useBattlefieldStore } from '~/features/battlefield';
import { useEventLogStore } from '~/features/eventLog';
import { useSettingsStore } from '~/stores/settings';
import { makeScryfallCard } from '../fixtures/cards';

const toastAdd = vi.fn();
vi.mock('@nuxt/ui/composables', () => ({
  useToast: () => ({ add: toastAdd }),
}));

function markers() {
  return useEventLogStore()
    .entries.filter((e) => e.type === 'gameMarker')
    .map((e) => ('reason' in e ? e.reason : ''));
}

describe('useReset', () => {
  it('new game starts one new game, with one toast', () => {
    const log = useEventLogStore();
    const before = log.gameId;
    toastAdd.mockClear();

    useReset().newGame();

    expect(markers()).toEqual(['newGame']);
    expect(log.gameId).not.toBe(before);
    expect(toastAdd).toHaveBeenCalledOnce();
  });

  it('clear board clears the board and logs it, in the same game', () => {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard());
    const log = useEventLogStore();
    const before = log.gameId;
    toastAdd.mockClear();

    useReset().clearBoard();

    expect(board.stacks).toEqual([]);
    expect(log.entries.at(-1)?.type).toBe('boardCleared');
    expect(markers()).toEqual([]);
    expect(log.gameId).toBe(before);
    expect(toastAdd).toHaveBeenCalledOnce();
  });

  it('reset app resets settings and empties the log, with one toast', () => {
    const settings = useSettingsStore();
    settings.imagesEnabled = !settings.imagesEnabled;
    const changed = settings.imagesEnabled;
    const log = useEventLogStore();
    useBattlefieldStore().castCard(makeScryfallCard());
    const before = log.gameId;
    toastAdd.mockClear();

    useReset().resetAppData();

    expect(settings.imagesEnabled).not.toBe(changed);
    expect(useBattlefieldStore().stacks).toEqual([]);
    expect(log.entries).toEqual([]);
    expect(log.gameId).not.toBe(before);
    expect(toastAdd).toHaveBeenCalledOnce();
  });

  it('a new game from the idle prompt says so', () => {
    useReset().newGame('idlePrompt');

    expect(markers()).toEqual(['idlePrompt']);
  });
});
