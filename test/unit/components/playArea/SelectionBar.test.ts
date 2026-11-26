import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectionBar from '~/components/playArea/SelectionBar.vue';
import {
  createBoardCard,
  useBattlefieldStore,
  useSelectionStore,
} from '~/features/battlefield';
import { useWidgetRegistry } from '~/features/widgets';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

function twoStacks() {
  const board = useBattlefieldStore();
  return [0, 1].map(
    (i) =>
      putOnBoard(board, createBoardCard(makeScryfallCard()), {
        x: i * 300,
        y: 0,
      }).id,
  );
}

const bar = () => document.querySelector('.selection-bar');

describe('SelectionBar (#216)', () => {
  afterEach(unmountAll);

  it('stays hidden for one stack selected outside selection mode', async () => {
    const [a, b] = twoStacks();
    const selection = useSelectionStore();
    mountInApp(SelectionBar);

    selection.selectOnly(a!);
    await flushPromises();
    expect(bar()).toBeNull();

    selection.toggle(b!);
    await flushPromises();
    expect(bar()?.textContent).toContain('2 selected');
  });

  it('shows for one stack in selection mode', async () => {
    const [a] = twoStacks();
    const selection = useSelectionStore();
    selection.setMode(true);
    selection.selectOnly(a!);
    mountInApp(SelectionBar);
    await flushPromises();
    expect(bar()?.textContent).toContain('1 selected');
  });

  it('shows the selection commands meant for it, as buttons', async () => {
    const [a, b] = twoStacks();
    const selection = useSelectionStore();
    selection.toggle(a!);
    selection.toggle(b!);
    const tap = vi.fn();
    useWidgetRegistry().register({
      id: 't',
      label: 'T',
      icon: 'i-lucide-plus',
      commands: [
        {
          id: 'tap',
          label: 'Tap',
          icon: 'i-lucide-plus',
          scope: 'selection',
          bar: 'button',
          execute: tap,
        },
        {
          id: 'palette-only',
          label: 'Palette only',
          icon: 'i-lucide-plus',
          scope: 'selection',
          execute: () => {},
        },
      ],
    });
    mountInApp(SelectionBar);
    await flushPromises();

    const button = bar()!.querySelector<HTMLButtonElement>(
      'button[aria-label="Tap"]',
    );
    button!.click();
    expect(tap).toHaveBeenCalledOnce();
    expect(bar()!.querySelector('[aria-label="Palette only"]')).toBeNull();
    // Nothing for the menu, so no "More" button.
    expect(bar()!.querySelector('[aria-label="More"]')).toBeNull();
  });
});
