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
  // #39
  it.each([
    ['clearBoard', 'clearBoard'],
    ['clearSession', 'clearSession'],
  ] as const)('%s starts one new game, with one toast', (action, reason) => {
    const log = useEventLogStore();
    const before = log.gameId;
    toastAdd.mockClear();

    useReset()[action]();

    expect(markers()).toEqual([reason]);
    expect(log.gameId).not.toBe(before);
    expect(toastAdd).toHaveBeenCalledOnce();
  });

  it('clears the board and logs it before the marker', () => {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard());

    useReset().clearBoard();

    expect(board.stacks).toEqual([]);
    const types = useEventLogStore().entries.map((e) => e.type);
    expect(types.slice(-2)).toEqual(['boardCleared', 'gameMarker']);
  });

  it('reset all data resets settings and empties the log, with one toast', () => {
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

  it('a session cleared from the idle prompt says so', () => {
    useReset().clearSession('idlePrompt');

    expect(markers()).toEqual(['idlePrompt']);
  });
});
