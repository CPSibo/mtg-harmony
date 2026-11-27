import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoardCard, useBattlefieldStore } from '~/features/battlefield';
import { useMeldAnimation, useTokenAnimation } from '~/features/castAnimation';
import { useSettingsStore } from '~/stores/settings';
import type { BoardCard } from '~/types/PlayArea';
import { makeMeldCards, makeScryfallCard } from '../../fixtures/cards';

// happy-dom lays nothing out, so stand in for what measures and animates.
const play = vi.hoisted(() => ({
  measureCards: vi.fn(),
  castSource: vi.fn(),
  cardImage: vi.fn(),
  playMoveAnimation: vi.fn(),
  playMeldAnimation: vi.fn(),
}));
vi.mock('~/features/castAnimation/play', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/features/castAnimation/play')>()),
  ...play,
}));

const RECT = { x: 10, y: 20, width: 100, height: 140 };

beforeEach(() => {
  for (const fn of Object.values(play)) fn.mockReset();
  play.measureCards.mockImplementation(
    (ids: string[]) => new Map(ids.map((id) => [id, RECT])),
  );
  play.cardImage.mockImplementation((id: string) => {
    const image = document.createElement('div');
    image.dataset.of = id;
    return image;
  });
  play.castSource.mockImplementation((element: Element | null) =>
    element ? { element, rect: RECT } : null,
  );
});

function boardWithMeldPair() {
  const board = useBattlefieldStore();
  const cards = makeMeldCards();
  board.castCard(cards.bruna);
  board.castCard(cards.gisela);
  const [bruna, gisela] = board.stacks.map((s) => s.primary) as [
    BoardCard,
    BoardCard,
  ];
  return { board, bruna, gisela, brisela: cards.brisela };
}

describe('useMeldAnimation (#204)', () => {
  it('flies the other half onto the melded card', () => {
    const { bruna, gisela, brisela } = boardWithMeldPair();
    const { meld } = useMeldAnimation();

    const melded = meld(bruna, brisela)!;

    expect(melded.scryfallInfo.name).toBe('Brisela, Voice of Nightmares');
    // Measured before the meld takes the other half off the board.
    const [source, meldedId] = play.playMeldAnimation.mock.calls[0]!;
    expect(source.element.dataset.of).toBe(gisela.id);
    expect(source.rect).toEqual(RECT);
    expect(meldedId).toBe(melded.id);
  });

  it('slides the second half out of the melded card on unmeld', () => {
    const { bruna, gisela, brisela } = boardWithMeldPair();
    const { meld, unmeld } = useMeldAnimation();
    const melded = meld(bruna, brisela)!;

    expect(unmeld(melded)?.map((c) => c.id)).toEqual([bruna.id, gisela.id]);

    expect(play.measureCards).toHaveBeenCalledWith([melded.id]);
    expect(play.playMoveAnimation).toHaveBeenCalledWith(
      new Map([[gisela.id, RECT]]),
      bruna.id,
      false,
    );
  });

  it('plays nothing with the card action flourish off', () => {
    useSettingsStore().attachFlareEnabled = false;
    const { bruna, brisela } = boardWithMeldPair();
    const { meld, unmeld } = useMeldAnimation();

    const melded = meld(bruna, brisela)!;
    unmeld(melded);

    expect(play.playMeldAnimation).not.toHaveBeenCalled();
    expect(play.playMoveAnimation).not.toHaveBeenCalled();
    expect(useBattlefieldStore().stacks).toHaveLength(2);
  });

  it('plays nothing when the meld fails', () => {
    const { board, bruna, gisela, brisela } = boardWithMeldPair();
    board.removeCard(gisela);

    expect(useMeldAnimation().meld(bruna, brisela)).toBeNull();
    expect(play.playMeldAnimation).not.toHaveBeenCalled();
  });
});

describe('useTokenAnimation (#204)', () => {
  function sourceOnBoard() {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard({ name: 'Mitotic Slime' }));
    return { board, source: board.stacks[0]!.primary };
  }

  it('slides the token out of the card that made it', () => {
    const { source } = sourceOnBoard();

    const stack = useTokenAnimation()(
      source,
      makeScryfallCard({ name: 'Ooze' }),
    );

    expect(stack.primary.scryfallInfo.name).toBe('Ooze');
    expect(play.playMoveAnimation).toHaveBeenCalledWith(
      new Map([[stack.primary.id, RECT]]),
      source.id,
      false,
    );
  });

  it('slides from the source itself when it is attached', () => {
    const { board, source } = sourceOnBoard();
    const aura = board.castCard(makeScryfallCard({ name: 'Aura' })).primary;
    board.dropCardOn(aura, source.stack!, 'attach');

    const stack = useTokenAnimation()(aura, makeScryfallCard({ name: 'Ooze' }));

    expect(play.measureCards).toHaveBeenCalledWith([aura.id]);
    expect(stack.primary.scryfallInfo.name).toBe('Ooze');
  });

  it('plays nothing with the card action flourish off', () => {
    useSettingsStore().attachFlareEnabled = false;
    const { source } = sourceOnBoard();

    useTokenAnimation()(source, makeScryfallCard({ name: 'Ooze' }));

    expect(play.playMoveAnimation).not.toHaveBeenCalled();
  });

  it('still works for a card no longer on the board', () => {
    const source = createBoardCard(makeScryfallCard());
    play.measureCards.mockReturnValue(new Map());

    const stack = useTokenAnimation()(
      source,
      makeScryfallCard({ name: 'Ooze' }),
    );

    expect(stack.primary.scryfallInfo.name).toBe('Ooze');
    expect(play.playMoveAnimation).not.toHaveBeenCalled();
  });
});
