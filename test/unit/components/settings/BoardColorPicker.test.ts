import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import BoardColorPicker from '~/components/settings/BoardColorPicker.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { cardData } from '~/features/battlefield/boardCard';
import { useSettingsStore } from '~/stores/settings';
import { putOnBoard } from '../../fixtures/board';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

const toggle = (name: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

describe('BoardColorPicker', () => {
  afterEach(unmountAll);

  it('offers each colour, colourless included, as a toggle', () => {
    mountInApp(BoardColorPicker);
    const names = [...document.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      'White',
      'Blue',
      'Black',
      'Red',
      'Green',
      'Colourless',
    ]);
    expect(toggle('White').getAttribute('aria-pressed')).toBe('false');
  });

  it('turns colours on and off in the settings', async () => {
    const settings = useSettingsStore();
    mountInApp(BoardColorPicker);

    toggle('Green').click();
    toggle('White').click();
    await nextTick();
    expect(settings.boardColors).toEqual(['W', 'G']);
    expect(toggle('Green').getAttribute('aria-pressed')).toBe('true');

    toggle('Green').click();
    await nextTick();
    expect(settings.boardColors).toEqual(['W']);
    expect(toggle('Green').getAttribute('aria-pressed')).toBe('false');
  });

  it('is disabled while the background is off', async () => {
    const settings = useSettingsStore();
    settings.setBoardBackgroundEnabled(false);
    mountInApp(BoardColorPicker);
    await nextTick();
    expect(toggle('Red').disabled).toBe(true);
  });

  it('shows the board’s colours, and can’t be changed, while auto colours are on', async () => {
    const settings = useSettingsStore();
    settings.setBoardColors(['W']);
    settings.setBoardColorsAuto(true);
    putOnBoard(
      useBattlefieldStore(),
      makeCard({
        scryfallInfo: cardData(makeScryfallCard({ color_identity: ['U'] })),
      }),
    );
    mountInApp(BoardColorPicker);
    await nextTick();
    expect(toggle('Blue').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('White').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Blue').disabled).toBe(true);
  });
});
