import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import GroupModifiersMenu from '~/components/playArea/GroupModifiersMenu.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

/** The button in the document labelled `label`. */
function buttonLabelled(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) throw new Error(`No button labelled "${label}"`);
  return button;
}

describe('GroupModifiersMenu (#221)', () => {
  afterEach(unmountAll);

  function setup() {
    const battlefield = useBattlefieldStore();
    const a = putOnBoard(battlefield, makeCard()).primary;
    const b = putOnBoard(battlefield, makeCard()).primary;
    battlefield.setModifierCount(a, 'plus-one', 2);
    mountInApp(GroupModifiersMenu, { props: { open: true, cards: [a, b] } });
    return { a, b };
  }

  it('changes every card by one, keeping their own counts', async () => {
    const { a, b } = setup();
    await nextTick();

    buttonLabelled('Add +1/+1').click();
    await nextTick();
    expect(a.modifiers.get('plus-one')).toBe(3);
    expect(b.modifiers.get('plus-one')).toBe(1);

    buttonLabelled('Remove +1/+1').click();
    await nextTick();
    expect(a.modifiers.get('plus-one')).toBe(2);
    expect(b.modifiers.has('plus-one')).toBe(false);
  });

  it('says how many of the cards have each modifier', async () => {
    setup();
    await nextTick();
    expect(document.body.textContent).toContain('on 1 of 2');
  });

  it('clears every card', async () => {
    const { a } = setup();
    await nextTick();
    buttonNamed('Clear all').click();
    await nextTick();
    expect(a.modifiers.size).toBe(0);
  });
});
