import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TokenPickerModal from '~/components/playArea/TokenPickerModal.vue';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard, makeTokenMaker } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

const fetchCardById = vi.fn();
vi.mock('~/composables/useScryfall', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/composables/useScryfall')>()),
  fetchCardById: (id: string) => fetchCardById(id),
}));

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
const FETCHED = {
  'ooze-id': makeScryfallCard({
    id: 'ooze-id',
    name: 'Ooze',
    type_line: OOZE.type_line,
    power: '3',
    toughness: '3',
  }),
  'clue-id': makeScryfallCard({
    id: 'clue-id',
    name: 'Clue',
    type_line: CLUE.type_line,
  }),
};

function source() {
  const board = useBattlefieldStore();
  const card = createBoardCard(
    makeTokenMaker([OOZE, CLUE], { name: 'Tireless Tracker' }),
  );
  return { board, card: putOnBoard(board, card).primary };
}

/** The tile for a token, by its name. */
const tile = (name: string) =>
  [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().startsWith(name),
  )!;

describe('TokenPickerModal (#203)', () => {
  beforeEach(() => {
    fetchCardById.mockReset();
    fetchCardById.mockImplementation(
      async (id: keyof typeof FETCHED) => FETCHED[id],
    );
  });
  afterEach(unmountAll);

  it("shows each token's name and type line straight away", async () => {
    fetchCardById.mockImplementation(() => new Promise(() => {}));
    const { card } = source();
    mountInApp(TokenPickerModal, { props: { source: card, open: true } });
    await flushPromises();

    expect(tile('Ooze').textContent).toContain('Token Creature — Ooze');
    expect(tile('Clue').textContent).toContain('Token Artifact — Clue');
  });

  it('fills in power and toughness once each token is fetched', async () => {
    const { card } = source();
    mountInApp(TokenPickerModal, { props: { source: card, open: true } });
    await flushPromises();

    expect(tile('Ooze').textContent).toContain('3/3');
    expect(tile('Clue').textContent).not.toContain('/');
  });

  it("shows a fetched token's rules text, to tell apart tokens that share a name", async () => {
    fetchCardById.mockImplementation(async (id: string) =>
      id === 'ooze-id'
        ? makeScryfallCard({ id, name: 'Ooze', oracle_text: 'Deathtouch' })
        : FETCHED['clue-id'],
    );
    const { card } = source();
    mountInApp(TokenPickerModal, { props: { source: card, open: true } });
    await flushPromises();

    expect(tile('Ooze').textContent).toContain('Deathtouch');
  });

  it('creates the picked token and closes', async () => {
    const { board, card } = source();
    const wrapper = mountInApp(TokenPickerModal, {
      props: { source: card, open: true },
    });
    await flushPromises();

    tile('Clue').click();
    await flushPromises();

    expect(board.stacks.at(-1)!.primary.scryfallInfo.name).toBe('Clue');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
