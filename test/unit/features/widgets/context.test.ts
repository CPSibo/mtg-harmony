import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useBattlefieldStore, useSelectionStore } from '~/features/battlefield';
import {
  useWidgetRegistry,
  type WidgetCommand,
  type WidgetDefinition,
} from '~/features/widgets';
import { putOnBoard } from '../../fixtures/board';
import { makeCard } from '../../fixtures/cards';

const toasts: { id?: string; title?: string }[] = [];
vi.mock('@nuxt/ui/composables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/ui/composables')>()),
  useToast: () => ({
    add: (toast: (typeof toasts)[number]) => toasts.push(toast),
  }),
}));

const cmd = (over: Partial<WidgetCommand> = {}): WidgetCommand => ({
  id: 'c',
  label: 'C',
  icon: 'i-lucide-plus',
  execute: () => {},
  ...over,
});
const widget = (over: Partial<WidgetDefinition>): WidgetDefinition => ({
  id: 'w',
  label: 'W',
  icon: 'i-lucide-plus',
  commands: [cmd()],
  ...over,
});

const press = (key: string) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));

function selectOne() {
  const stack = putOnBoard(useBattlefieldStore(), makeCard());
  useSelectionStore().selectOnly(stack.id);
}

describe('palette context (#235)', () => {
  const registered: string[] = [];
  function register(w: WidgetDefinition) {
    useWidgetRegistry().register(w);
    registered.push(w.id);
  }
  afterEach(() => {
    for (const id of registered.splice(0)) useWidgetRegistry().unregister(id);
  });

  it('orders groups by their order, then as registered', () => {
    register(widget({ id: 'late', label: 'Late', order: 80 }));
    register(widget({ id: 'none', label: 'None' }));
    register(widget({ id: 'early', label: 'Early', order: 10 }));
    expect(useWidgetRegistry().paletteGroups.map((g) => g.label)).toEqual([
      'Early',
      'Late',
      'None',
    ]);
  });

  it('hides a group marked so while something is selected', async () => {
    register(widget({ id: 'deck', label: 'Deck', hideWithSelection: true }));
    register(widget({ id: 'board', label: 'Board' }));
    const groups = () => useWidgetRegistry().paletteGroups.map((g) => g.label);
    expect(groups()).toEqual(['Deck', 'Board']);

    selectOne();
    await nextTick();
    expect(groups()).toEqual(['Board']);
  });

  it('still runs a hidden group’s shortcut', () => {
    const execute = vi.fn();
    register(
      widget({
        id: 'deck',
        hideWithSelection: true,
        commands: [cmd({ kbds: 'q', execute })],
      }),
    );
    selectOne();
    press('q');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('shows a label that depends on the state', async () => {
    const tapped = ref(false);
    register(
      widget({
        commands: [cmd({ label: () => (tapped.value ? 'Untap' : 'Tap') })],
      }),
    );
    const label = () => useWidgetRegistry().paletteGroups[0]!.items[0]!.label;
    expect(label()).toBe('Tap');
    tapped.value = true;
    await nextTick();
    expect(label()).toBe('Untap');
  });

  it('leaves selection mode for a command that isn’t about the selection', () => {
    register(
      widget({
        commands: [
          cmd({ id: 'other', label: 'Other' }),
          cmd({ id: 'sel', label: 'Sel', scope: 'selection' }),
          cmd({ id: 'build', label: 'Build', keepsSelectionMode: true }),
        ],
      }),
    );
    const selection = useSelectionStore();
    const item = (label: string) =>
      useWidgetRegistry()
        .paletteGroups.flatMap((g) => g.items)
        .find((i) => i.label === label)!;
    selectOne();

    selection.setMode(true);
    item('Sel').onSelect();
    item('Build').onSelect();
    expect(selection.mode).toBe(true);

    item('Other').onSelect();
    expect(selection.mode).toBe(false);
    // The selection itself stays.
    expect(selection.size).toBe(1);
  });

  it('leaves selection mode for a shortcut that isn’t about the selection', () => {
    register(widget({ commands: [cmd({ kbds: 'q' })] }));
    const selection = useSelectionStore();
    selection.setMode(true);
    press('q');
    expect(selection.mode).toBe(false);
  });

  it('runs a space-space shortcut, unless its guard says no', () => {
    const execute = vi.fn();
    const allowed = ref(true);
    register(
      widget({
        commands: [
          cmd({
            kbds: 'space-space',
            shortcutGuard: () => allowed.value,
            execute,
          }),
        ],
      }),
    );
    press(' ');
    press(' ');
    expect(execute).toHaveBeenCalledOnce();

    allowed.value = false;
    press(' ');
    press(' ');
    expect(execute).toHaveBeenCalledOnce();
  });

  describe('toasts', () => {
    afterEach(() => (toasts.length = 0));

    it('says what a command did, read before it runs', () => {
      const n = ref(1);
      register(
        widget({
          commands: [
            cmd({
              kbds: 'q',
              toast: () => `Did ${n.value}`,
              execute: () => n.value++,
            }),
          ],
        }),
      );
      press('q');
      expect(toasts).toEqual([
        expect.objectContaining({ id: 'c', title: 'Did 1' }),
      ]);
    });

    it('says nothing for a command without one', () => {
      register(widget({ commands: [cmd({ kbds: 'q' })] }));
      press('q');
      expect(toasts).toEqual([]);
    });

    it('uses a choice’s own toast', () => {
      register(
        widget({
          commands: [
            cmd({
              label: 'Copy',
              choices: [
                {
                  label: 'Card only',
                  icon: 'i-lucide-copy',
                  toast: () => 'Copied',
                  execute: () => {},
                },
              ],
            }),
          ],
        }),
      );
      const item = useWidgetRegistry().paletteGroups[0]!.items[0]!;
      item.children![0]!.onSelect();
      expect(toasts).toEqual([expect.objectContaining({ title: 'Copied' })]);
    });
  });
});
