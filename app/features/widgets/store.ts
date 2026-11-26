import { defineShortcuts } from '@nuxt/ui/composables';
import { defineStore } from 'pinia';
import { computed, shallowRef, triggerRef } from 'vue';
import type { Fn } from '@vueuse/core';
import { useSelectionStore } from '~/features/battlefield/selection';
import type { WidgetCommand, WidgetDefinition } from '~/features/widgets/types';

const applies = (cmd: WidgetCommand) => cmd.enabled?.() ?? true;

/** A command's label as it reads now. */
export const commandLabel = (cmd: WidgetCommand) =>
  typeof cmd.label === 'function' ? cmd.label() : cmd.label;

/**
 * Nuxt UI matches a chord by the keys' values joined with '-', and Space's
 * value is ' ', so 'space-space' is registered as ' - '.
 */
const shortcutKey = (kbds: string) =>
  kbds
    .split('-')
    .map((k) => (k === 'space' ? ' ' : k))
    .join('-');

export const useWidgetRegistry = defineStore('widgetRegistry', () => {
  // Definitions are fixed once registered: shallow, triggered on register and
  // unregister. The shortcuts' unregister functions are only read here.
  const widgets = shallowRef(new Map<string, WidgetDefinition>());
  const widgetShortcuts = new Map<string, Fn>();
  const selection = useSelectionStore();

  /**
   * Runs a command from the palette or its shortcut. Anything not about the
   * selection leaves selection mode first (#235); the selection stays.
   */
  function run(
    cmd: Pick<WidgetCommand, 'scope' | 'keepsSelectionMode'>,
    action: () => void,
  ) {
    if (cmd.scope !== 'selection' && !cmd.keepsSelectionMode)
      selection.setMode(false);
    action();
  }

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget);
    triggerRef(widgets);

    const shortcuts: Record<string, () => void> = {};
    for (const cmd of widget.commands)
      if (cmd.kbds)
        shortcuts[shortcutKey(cmd.kbds)] = () => {
          if (applies(cmd) && (cmd.shortcutGuard?.() ?? true))
            run(cmd, cmd.execute);
        };
    widgetShortcuts.set(widget.id, defineShortcuts(shortcuts));
  }

  function unregister(id: string) {
    widgetShortcuts.get(id)?.();
    widgetShortcuts.delete(id);

    widgets.value.delete(id);
    triggerRef(widgets);
  }

  // In palette order: by `order`, then as registered (sort is stable).
  const widgetObjects = computed(() =>
    [...widgets.value.values()].sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    ),
  );

  const allCommands = computed(() =>
    widgetObjects.value.flatMap((w) => w.commands),
  );

  /** Selection commands that apply now, from every widget (#216). */
  const selectionCommands = computed(() =>
    allCommands.value.filter((c) => c.scope === 'selection' && applies(c)),
  );

  const toItem = (cmd: WidgetCommand) => ({
    label: commandLabel(cmd),
    description: cmd.description,
    icon: cmd.icon,
    // Shortcuts are chords like 'b-a'; the palette shows one key per entry.
    kbds: cmd.kbds?.split('-'),
    onSelect: () => run(cmd, cmd.execute),
    // The palette opens these as a page of their own.
    children: cmd.choices?.map((c) => ({
      label: c.label,
      icon: c.icon,
      onSelect: () => run(cmd, c.execute),
    })),
  });

  const paletteGroups = computed(() =>
    [
      {
        id: 'selection',
        label: 'Selection',
        items: selectionCommands.value.map(toItem),
      },
      ...widgetObjects.value
        .filter((w) => !(w.hideWithSelection && selection.size))
        .map((w) => ({
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
