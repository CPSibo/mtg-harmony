import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoardContextMenu from '~/components/playArea/BoardContextMenu.vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useWidgetRegistry, type WidgetDefinition } from '~/features/widgets';
import { mountInApp, unmountAll } from '../../fixtures/mount';

function registerCast() {
  const execute = vi.fn();
  const executeAt = vi.fn();
  const widget: WidgetDefinition = {
    id: 'onDeck',
    label: 'On-deck',
    icon: 'i-lucide-user-plus',
    commands: [
      {
        id: 'onDeck.cast',
        label: 'Cast On-deck card to board',
        icon: 'i-lucide-user-plus',
        execute,
        executeAt,
      },
    ],
  };
  useWidgetRegistry().register(widget);
  return { execute, executeAt };
}

const menuItems = () => [...document.querySelectorAll('[role="menuitem"]')];

describe('BoardContextMenu (#244)', () => {
  afterEach(unmountAll);

  it('opens at a point, and casts at the board point under it', async () => {
    const { execute, executeAt } = registerCast();
    const board = useBattlefieldStore();
    board.setTransform({ x: 100, y: 50, scale: 2 });
    const wrapper = mountInApp(BoardContextMenu);

    (wrapper.vm as unknown as { open(at: object): void }).open({
      x: 300,
      y: 250,
    });
    await flushPromises();

    const items = menuItems();
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Cast On-deck card here'),
    ]);
    (items[0] as HTMLElement).click();
    expect(executeAt).toHaveBeenCalledWith(
      board.boardPointFromScreen({ x: 300, y: 250 }),
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
