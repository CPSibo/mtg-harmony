import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CardDetails from '~/components/playArea/CardDetails.vue';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard, makeTokenMaker } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

const fetchCardById = vi.fn();
vi.mock('~/composables/useScryfall', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/composables/useScryfall')>()),
  fetchCardById: (id: string) => fetchCardById(id),
}));

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

describe('CardDetails: Create token (#203)', () => {
  const OOZE = {
    id: 'ooze-id',
    name: 'Ooze',
    type_line: 'Token Creature — Ooze',
  };
  const CLUE = {
    id: 'clue-id',
    name: 'Clue',
    type_line: 'Token Artifact — Clue',
  };

  beforeEach(() => {
    fetchCardById.mockReset();
    fetchCardById.mockImplementation(async (id: string) =>
      makeScryfallCard({ id, name: id === 'ooze-id' ? 'Ooze' : 'Clue' }),
    );
  });
  afterEach(unmountAll);

  function boardCard(tokens: (typeof OOZE)[]) {
    const board = useBattlefieldStore();
    const card = createBoardCard(
      makeTokenMaker(tokens, { name: 'Mitotic Slime' }),
    );
    return { board, card: putOnBoard(board, card).primary };
  }

  it('creates the only token at once, and closes', async () => {
    const { board, card } = boardCard([OOZE]);
    const wrapper = mountInApp(CardDetails, { props: { card, open: true } });
    await flushPromises();

    buttonNamed('Create Ooze').click();
    await flushPromises();

    expect(fetchCardById).toHaveBeenCalledWith('ooze-id');
    expect(board.stacks.map((s) => s.primary.scryfallInfo.name)).toEqual([
      'Mitotic Slime',
      'Ooze',
    ]);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('opens a picker for a card with several tokens', async () => {
    const { card } = boardCard([OOZE, CLUE]);
    const wrapper = mountInApp(CardDetails, { props: { card, open: true } });
    await flushPromises();

    buttonNamed('Create token…').click();
    await flushPromises();

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    // The picker loads on first use.
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Token Artifact — Clue'),
    );
  });

  it('has no Create button for a card that makes no tokens', async () => {
    const card = putOnBoard(
      useBattlefieldStore(),
      createBoardCard(makeScryfallCard()),
    ).primary;
    mountInApp(CardDetails, { props: { card, open: true } });
    await flushPromises();

    expect(document.body.textContent).not.toContain('Create');
  });
});
