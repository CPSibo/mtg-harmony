import { describe, expect, it } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { cardData } from '~/features/battlefield/boardCard';
import { useBoardColors } from '~/features/boardBackground/useBoardColors';
import { useSettingsStore } from '~/stores/settings';
import { putOnBoard } from '../../fixtures/board';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

const withIdentity = (color_identity: string[]) =>
  makeCard({
    scryfallInfo: cardData(makeScryfallCard({ color_identity })),
  });

function colors() {
  return effectScope().run(() => useBoardColors())!;
}

describe('useBoardColors', () => {
  it('is the picked colours while auto colours are off', () => {
    const settings = useSettingsStore();
    const board = useBattlefieldStore();
    putOnBoard(board, withIdentity(['R']));
    settings.setBoardColors(['W', 'U']);
    expect(colors().value).toEqual(['W', 'U']);
  });

  it('follows the cards on the board while auto colours are on', async () => {
    const settings = useSettingsStore();
    const board = useBattlefieldStore();
    settings.setBoardColors(['W']);
    settings.setBoardColorsAuto(true);
    const shown = colors();
    expect(shown.value).toEqual([]);

    const red = putOnBoard(board, withIdentity(['R']));
    const green = putOnBoard(board, withIdentity(['G']));
    await nextTick();
    expect(shown.value).toEqual(['R', 'G']);

    // Attachments and unders count too.
    green.unders.add(withIdentity(['B']));
    green.attachments.add(withIdentity([]));
    await nextTick();
    expect(shown.value).toEqual(['B', 'R', 'G', 'C']);

    board.removeCard(red.primary);
    await nextTick();
    expect(shown.value).toEqual(['B', 'G', 'C']);

    // The picked colours come back when it's turned off.
    settings.setBoardColorsAuto(false);
    expect(shown.value).toEqual(['W']);
  });
});
