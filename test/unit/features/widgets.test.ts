import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import { useWidgetRegistry } from '~/features/widgets/store';
import type { WidgetDefinition } from '~/features/widgets/types';

const widget = (id: string): WidgetDefinition =>
  ({
    id,
    label: id,
    icon: 'i-lucide-plus',
    commands: [{ id: `${id}.go`, label: 'Go', execute: () => {} }],
  }) as unknown as WidgetDefinition;

describe('widget registry', () => {
  it('lists registered widgets in the palette, and drops unregistered ones', () => {
    const registry = useWidgetRegistry();

    registry.register(widget('a'));
    registry.register(widget('b'));
    expect(registry.paletteGroups.map((g) => g.id)).toEqual(['a', 'b']);

    registry.unregister('a');
    expect(registry.paletteGroups.map((g) => g.id)).toEqual(['b']);
  });

  // #105: definitions are fixed once registered, so they aren't made deeply reactive.
  it('keeps widget definitions out of Vue reactivity', () => {
    const registry = useWidgetRegistry();
    registry.register(widget('a'));

    expect(isReactive(registry.allCommands[0])).toBe(false);
  });
});
