import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import TapButton from '~/components/layout/TapButton.vue';
import { useBattlefieldStore, useSelectionStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('TapButton (#235)', () => {
  afterEach(unmountAll);

  function setup() {
    const battlefield = useBattlefieldStore();
    const a = putOnBoard(battlefield, makeCard({ tapped: true }));
    const b = putOnBoard(battlefield, makeCard());
    const wrapper = mountInApp(TapButton);
    const button = () => wrapper.get('button');
    return { a, b, button };
  }

  it('untaps everything with nothing selected', async () => {
    const { a, button } = setup();
    expect(button().attributes('aria-label')).toBe('Untap all');
    await button().trigger('click');
    expect(a.primary.tapped).toBe(false);
  });

  it('taps or untaps the selected cards', async () => {
    const { a, b, button } = setup();
    useSelectionStore().selectOnly(b.id);
    await nextTick();
    expect(button().attributes('aria-label')).toBe('Tap selected card');
    await button().trigger('click');
    expect(b.primary.tapped).toBe(true);
    // The rest of the board is left alone.
    expect(a.primary.tapped).toBe(true);
    expect(button().attributes('aria-label')).toBe('Untap selected card');
  });
});
