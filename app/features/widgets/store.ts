import { defineShortcuts } from '@nuxt/ui/composables';
import { defineStore } from 'pinia';
import { computed, shallowRef, triggerRef } from 'vue';
import type { Fn } from '@vueuse/core';
import type { WidgetCommand, WidgetDefinition } from '~/features/widgets/types';

const applies = (cmd: WidgetCommand) => cmd.enabled?.() ?? true;

export const useWidgetRegistry = defineStore('widgetRegistry', () => {
  // Definitions are fixed once registered: shallow, triggered on register and
  // unregister. The shortcuts' unregister functions are only read here.
  const widgets = shallowRef(new Map<string, WidgetDefinition>());
  const widgetShortcuts = new Map<string, Fn>();

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget);
    triggerRef(widgets);

    const shortcuts: Record<string, () => void> = {};
    for (const cmd of widget.commands)
      if (cmd.kbds)
        shortcuts[cmd.kbds] = () => {
          if (applies(cmd)) cmd.execute();
        };
    widgetShortcuts.set(widget.id, defineShortcuts(shortcuts));
  }

  function unregister(id: string) {
    widgetShortcuts.get(id)?.();
    widgetShortcuts.delete(id);

    widgets.value.delete(id);
    triggerRef(widgets);
  }

  const widgetObjects = computed(() => [...widgets.value.values()]);

  const allCommands = computed(() =>
    widgetObjects.value.flatMap((w) => w.commands),
  );

  /** Selection commands that apply now, from every widget (#216). */
  const selectionCommands = computed(() =>
    allCommands.value.filter((c) => c.scope === 'selection' && applies(c)),
  );

  const toItem = (cmd: WidgetCommand) => ({
    label: cmd.label,
    description: cmd.description,
    icon: cmd.icon,
    // Shortcuts are chords like 'b-a'; the palette shows one key per entry.
    kbds: cmd.kbds?.split('-'),
    onSelect: cmd.execute,
  });

  const paletteGroups = computed(() =>
    [
      {
        id: 'selection',
        label: 'Selection',
        items: selectionCommands.value.map(toItem),
      },
      ...widgetObjects.value.map((w) => ({
        id: w.id,
        label: w.label,
        items: w.commands
          .filter((c) => c.scope !== 'selection' && applies(c))
          .map(toItem),
      })),
    ].filter((g) => g.items.length),
  );

  return {
    register,
    unregister,
    allCommands,
    selectionCommands,
    paletteGroups,
  };
});
