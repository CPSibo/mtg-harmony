import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useWidgetRegistry, type WidgetDefinition } from '~/features/widgets';

function widget(over: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return { id: 'w', label: 'W', icon: 'i-lucide-plus', commands: [], ...over };
}

const press = (key: string) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));

describe('useWidgetRegistry (#216)', () => {
  it('lists a widget as a palette group', () => {
    const registry = useWidgetRegistry();
    registry.register(
      widget({
        commands: [
          { id: 'a', label: 'A', icon: 'i-lucide-plus', execute: () => {} },
        ],
      }),
    );
    expect(registry.paletteGroups.map((g) => g.label)).toEqual(['W']);
    expect(registry.paletteGroups[0]!.items.map((i) => i.label)).toEqual(['A']);
  });

  it('hides a command while it does not apply, and an empty group', async () => {
    const applies = ref(false);
    const registry = useWidgetRegistry();
    registry.register(
      widget({
        commands: [
          {
            id: 'a',
            label: 'A',
            icon: 'i-lucide-plus',
            enabled: () => applies.value,
            execute: () => {},
          },
        ],
      }),
    );
    expect(registry.paletteGroups).toEqual([]);

    applies.value = true;
    await nextTick();
    expect(registry.paletteGroups[0]!.items.map((i) => i.label)).toEqual(['A']);
  });

  it('puts selection commands from every widget in one Selection group, first', () => {
    const registry = useWidgetRegistry();
    const cmd = (id: string, scope?: 'selection') => ({
      id,
      label: id,
      icon: 'i-lucide-plus',
      scope,
      execute: () => {},
    });
    registry.register(
      widget({
        id: 'one',
        label: 'One',
        commands: [cmd('a'), cmd('tap', 'selection')],
      }),
    );
    registry.register(
      widget({ id: 'two', label: 'Two', commands: [cmd('copy', 'selection')] }),
    );

    expect(registry.paletteGroups.map((g) => g.label)).toEqual([
      'Selection',
      'One',
    ]);
    expect(registry.paletteGroups[0]!.items.map((i) => i.label)).toEqual([
      'tap',
      'copy',
    ]);
    expect(registry.selectionCommands.map((c) => c.id)).toEqual([
      'tap',
      'copy',
    ]);
  });

  it("doesn't run a shortcut while its command doesn't apply", async () => {
    const applies = ref(false);
    const execute = vi.fn();
    const registry = useWidgetRegistry();
    registry.register(
      widget({
        commands: [
          {
            id: 'a',
            label: 'A',
            icon: 'i-lucide-plus',
            kbds: 'q',
            enabled: () => applies.value,
            execute,
          },
        ],
      }),
    );

    press('q');
    expect(execute).not.toHaveBeenCalled();

    applies.value = true;
    press('q');
    expect(execute).toHaveBeenCalledOnce();
    registry.unregister('w');
  });

  it('leaves a shortcut-only command out of the palette, but runs it', () => {
    const execute = vi.fn();
    const registry = useWidgetRegistry();
    registry.register(
      widget({
        commands: [
          { id: 'a', label: 'A', icon: 'i-lucide-plus', execute: () => {} },
          {
            id: 'b',
            label: 'A',
            icon: 'i-lucide-plus',
            kbds: 'q',
            shortcutOnly: true,
            execute,
          },
        ],
      }),
    );
    expect(registry.paletteGroups[0]!.items.map((i) => i.label)).toEqual(['A']);
    press('q');
    expect(execute).toHaveBeenCalledOnce();
    registry.unregister('w');
  });

  it("lists a command's choices as its palette item's children (#221)", () => {
    const picked: string[] = [];
    const registry = useWidgetRegistry();
    registry.register(
      widget({
        commands: [
          {
            id: 'copy',
            label: 'Copy',
            icon: 'i-lucide-copy',
            execute: () => {},
            choices: [
              {
                label: 'Card only',
                icon: 'i-lucide-copy',
                execute: () => picked.push('card'),
              },
            ],
          },
        ],
      }),
    );
    const [item] = registry.paletteGroups[0]!.items;
    expect(item!.children?.map((c) => c.label)).toEqual(['Card only']);
    item!.children![0]!.onSelect();
    expect(picked).toEqual(['card']);
  });
});
