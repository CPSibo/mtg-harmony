import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import CardDetails from '~/components/playArea/CardDetails.vue';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

/** A Room with its first door unlocked and its second locked. */
function boardRoom() {
  const card = createBoardCard(
    makeScryfallCard({
      name: 'Bottomless Pool // Locker Room',
      layout: 'split',
      type_line: 'Enchantment — Room // Enchantment — Room',
      card_faces: [
        { name: 'Bottomless Pool', type_line: 'Enchantment — Room' },
        { name: 'Locker Room', type_line: 'Enchantment — Room' },
      ],
    }),
  );
  card.lockedDoors = [1];
  const board = useBattlefieldStore();
  return putOnBoard(board, card).primary;
}

describe('CardDetails', () => {
  afterEach(unmountAll);

  it.each([
    ['Lock Bottomless Pool', [0, 1]],
    ['Unlock Locker Room', []],
  ])('closes after "%s" (#205)', async (name, lockedDoors) => {
    const card = boardRoom();
    const wrapper = mountInApp(CardDetails, { props: { card, open: true } });
    await flushPromises();

    buttonNamed(name).click();
    await flushPromises();

    expect(card.lockedDoors).toEqual(lockedDoors);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
