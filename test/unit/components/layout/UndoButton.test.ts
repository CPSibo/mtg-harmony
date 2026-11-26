import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import UndoButton from '~/components/layout/UndoButton.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { makeScryfallCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('UndoButton (#215)', () => {
  afterEach(unmountAll);

  it('is disabled with nothing to undo', () => {
    const wrapper = mountInApp(UndoButton);
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });

  it('undoes the last structural change', async () => {
    const battlefield = useBattlefieldStore();
    battlefield.castCard(makeScryfallCard());
    const wrapper = mountInApp(UndoButton);
    await nextTick();
    const button = wrapper.get('button');
    expect(button.attributes('aria-label')).toBe('Undo');
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');
    expect(battlefield.stacks).toHaveLength(0);
    expect(button.attributes('disabled')).toBeDefined();
  });
});
