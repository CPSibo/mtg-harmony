import { defineShortcuts } from '@nuxt/ui/composables';
import { defineStore } from 'pinia';
import { computed, shallowRef, triggerRef } from 'vue';
import type { Fn } from '@vueuse/core';
import type { WidgetDefinition } from '~/features/widgets/types';

export const useWidgetRegistry = defineStore('widgetRegistry', () => {
  // Definitions are fixed once registered: shallow, triggered on register and
  // unregister. The shortcuts' unregister functions are only read here.
  const widgets = shallowRef(new Map<string, WidgetDefinition>());
  const widgetShortcuts = new Map<string, Fn>();

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget);
    triggerRef(widgets);

    const unregister = defineShortcuts(
      widget.commands
        .filter((f) => !!f.kbds)
        .reduce(
          (total, current) => ({
            ...total,
            [current.kbds!]: current.execute,
          }),
          {},
        ),
    );

    widgetShortcuts.set(widget.id, unregister);
  }

  function unregister(id: string) {
    const unregister = widgetShortcuts.get(id);

    if (unregister) unregister();

    widgetShortcuts.delete(id);

    widgets.value.delete(id);
    triggerRef(widgets);
  }

  const widgetObjects = computed(() => {
    return [...widgets.value.values()];
  });

  const allCommands = computed(() =>
    widgetObjects.value.flatMap((w) => w.commands),
  );

  const paletteGroups = computed(() =>
    widgetObjects.value.map((w) => ({
      id: w.id,
      label: w.label,
      items: w.commands.map((cmd) => ({
        label: cmd.label,
        icon: cmd.icon,
        // Shortcuts are chords like 'b-a'; the palette shows one key per entry.
        kbds: cmd.kbds?.split('-'),
        onSelect: cmd.execute,
      })),
    })),
  );

  return { register, unregister, allCommands, paletteGroups };
});
