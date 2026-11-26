import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TapButton from '~/components/layout/TapButton.vue';
import BoardCardStackActions from '~/components/playArea/BoardCardStackActions.vue';
import CardDetails from '~/components/playArea/CardDetails.vue';
import RemoveCardsModal from '~/components/playArea/RemoveCardsModal.vue';
import { cardsLabel } from '~/composables/useActionToast';
import { useBattlefieldStore, useSelectionStore } from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

const toasts: { id?: string; title?: string }[] = [];
vi.mock('@nuxt/ui/composables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/ui/composables')>()),
  useToast: () => ({
    add: (toast: (typeof toasts)[number]) => toasts.push(toast),
  }),
}));

const buttonLabelled = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

/** A card on the board, named `name`. */
function boardCard(name = 'Grizzly Bears') {
  return putOnBoard(useBattlefieldStore(), makeCard({ name }));
}

describe('cardsLabel (#237)', () => {
  it('names one card and counts more', () => {
    const a = makeCard({ name: 'Grizzly Bears' });
    const b = makeCard({ name: 'Llanowar Elves' });
    expect(cardsLabel([a])).toBe('Grizzly Bears');
    expect(cardsLabel([a, b])).toBe('2 cards');
  });
});

// The same toasts, under the same names, as the palette's commands.
describe('toasts for actions outside the palette (#237)', () => {
  beforeEach(() => (toasts.length = 0));
  afterEach(unmountAll);

  it('a stack’s Tap button', async () => {
    const stack = boardCard();
    mountInApp(BoardCardStackActions, { props: { stack } });
    await flushPromises();

    buttonLabelled('Tap').click();
    expect(toasts).toEqual([
      expect.objectContaining({
        id: 'selection.tap',
        title: 'Tapped Grizzly Bears',
      }),
    ]);
  });

  it('removing a card from its details', async () => {
    const stack = boardCard();
    mountInApp(CardDetails, { props: { card: stack.primary, open: true } });
    await flushPromises();

    buttonNamed('Remove').click();
    await flushPromises();
    // The confirm's own Remove button, the last one in the document.
    const confirms = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Remove',
    );
    confirms.at(-1)!.click();
    await flushPromises();

    expect(toasts).toContainEqual(
      expect.objectContaining({
        id: 'selection.remove',
        title: 'Removed Grizzly Bears',
      }),
    );
  });

  it('removing several cards', async () => {
    const cards = [boardCard().primary, boardCard('Llanowar Elves').primary];
    mountInApp(RemoveCardsModal, { props: { open: true, cards } });
    await flushPromises();

    const confirm = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Remove'),
    )!;
    confirm.click();
    expect(toasts).toEqual([
      expect.objectContaining({ title: 'Removed 2 cards' }),
    ]);
  });

  it('flipping from the details', async () => {
    const stack = boardCard();
    mountInApp(CardDetails, { props: { card: stack.primary, open: true } });
    await flushPromises();

    buttonNamed('Flip over').click();
    expect(toasts).toEqual([
      expect.objectContaining({
        id: 'selection.flip',
        title: 'Flipped Grizzly Bears',
      }),
    ]);
  });

  it('the top bar’s tap button', async () => {
    const stack = boardCard();
    stack.primary.tapped = true;
    mountInApp(TapButton);
    await flushPromises();

    buttonLabelled('Untap all').click();
    expect(toasts).toEqual([
      expect.objectContaining({
        id: 'board.untapAll',
        title: 'Untapped every card',
      }),
    ]);

    useSelectionStore().selectOnly(stack.id);
    await flushPromises();
    buttonLabelled('Tap selected card').click();
    expect(toasts.at(-1)).toEqual(
      expect.objectContaining({
        id: 'selection.tap',
        title: 'Tapped Grizzly Bears',
      }),
    );
  });
});
