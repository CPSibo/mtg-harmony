import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import BoardCard from '~/components/playArea/BoardCard.vue';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

/** A Room with both doors unlocked, on the board. */
function boardRoom() {
  const card = createBoardCard(
    makeScryfallCard({
      name: 'Bottomless Pool // Locker Room',
      layout: 'split',
      type_line: 'Enchantment — Room // Enchantment — Room',
      image_uris: { normal: 'https://cards.example/room.jpg' },
      card_faces: [
        { name: 'Bottomless Pool', type_line: 'Enchantment — Room' },
        { name: 'Locker Room', type_line: 'Enchantment — Room' },
      ],
    }),
  );
  card.lockedDoors = [];
  return putOnBoard(useBattlefieldStore(), card).primary;
}

// Transitions run for real here (test-utils stubs them by default), so each
// test can see whether one started.
function mountCard(card = boardRoom()) {
  mountInApp(BoardCard, {
    props: { card },
    global: { stubs: { transition: false, 'transition-group': false } },
  });
  return card;
}

/** Whether any element matching `selector` is animating in. */
const entering = (selector: string) =>
  [...document.querySelectorAll(selector)].some((e) =>
    e.className.includes('-enter-active'),
  );

describe('BoardCard: card change effects (#204)', () => {
  afterEach(unmountAll);

  it('drops a padlock in when a door is locked', async () => {
    const card = mountCard();

    useBattlefieldStore().setDoorLocked(card, 1, true);
    await nextTick();

    expect(document.querySelector('.door-lock')).not.toBeNull();
    expect(entering('.door-lock')).toBe(true);
  });

  it('pops a counter in when one is added, and bumps its count', async () => {
    const card = mountCard();
    const board = useBattlefieldStore();

    board.setModifierCount(card, 'plus-one', 1);
    await nextTick();
    expect(entering('.modifier-icon')).toBe(true);

    board.setModifierCount(card, 'plus-one', 2);
    await nextTick();
    board.setModifierCount(card, 'plus-one', 3);
    await nextTick();
    expect(entering('.modifier-icon-count')).toBe(true);
  });

  it('plays nothing with the card action flourish off', async () => {
    useSettingsStore().attachFlareEnabled = false;
    const card = mountCard();
    const board = useBattlefieldStore();

    board.setDoorLocked(card, 1, true);
    board.setModifierCount(card, 'plus-one', 1);
    await nextTick();

    expect(document.querySelector('.door-lock')).not.toBeNull();
    expect(entering('.door-lock')).toBe(false);
    expect(entering('.modifier-icon')).toBe(false);
  });

  it('plays nothing for what the card already had when it appears', () => {
    const room = boardRoom();
    room.lockedDoors = [0];
    room.modifiers.set('plus-one', 2);
    mountCard(room);

    expect(entering('.door-lock')).toBe(false);
    expect(entering('.modifier-icon')).toBe(false);
  });
});
