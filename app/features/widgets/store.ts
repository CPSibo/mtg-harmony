import { defineShortcuts } from '@nuxt/ui/composables';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Fn } from '@vueuse/core';
import type { WidgetDefinition } from '~/features/widgets/types';

export const useWidgetRegistry = defineStore('widgetRegistry', () => {
  const widgets = ref<Map<string, WidgetDefinition>>(new Map());
  const widgetShortcuts = ref<Map<string, Fn>>(new Map());

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget);

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

    widgetShortcuts.value.set(widget.id, unregister);
  }

  function unregister(id: string) {
    const unregister = widgetShortcuts.value.get(id);

    if (unregister) unregister();

    widgetShortcuts.value.delete(id);

    widgets.value.delete(id);
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
