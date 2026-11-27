import { defineShortcuts } from '@nuxt/ui/composables';
import { defineStore } from 'pinia';
import { computed, shallowRef, triggerRef } from 'vue';
import type { Fn } from '@vueuse/core';
import { useActionToast } from '~/composables/useActionToast';
import { useSelectionStore } from '~/features/battlefield/selection';
import type {
  WidgetCommand,
  WidgetCommandChoice,
  WidgetDefinition,
} from '~/features/widgets/types';
import type { Position } from '@vueuse/core';

/** Whether a command applies right now (`enabled`, or always). */
export const commandApplies = (cmd: WidgetCommand) => cmd.enabled?.() ?? true;
const applies = commandApplies;

/** A command's label as it reads now. */
export const commandLabel = (cmd: WidgetCommand) =>
  typeof cmd.label === 'function' ? cmd.label() : cmd.label;

/**
 * A command's shortcut as menus show it, one key per entry: shortcuts are
 * chords like 'b-a' or combinations like 'meta_z'.
 */
export const commandKbds = (cmd: WidgetCommand) => cmd.kbds?.split(/[-_]/);

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
  const actionToast = useActionToast();

  /**
   * Runs a command, or one of its choices, from the palette, its shortcut or
   * the selection bar. Anything not about the selection leaves selection
   * mode first (#235); the selection stays. Then its toast (#237), if it has one,
   * says what it did, named after the command: a card's own button for the
   * same thing uses the same name (`useActionToast`). From the board menu,
   * `at` is the board point it opened at, for commands with `executeAt`.
   */
  function run(
    cmd: WidgetCommand,
    choice?: WidgetCommandChoice,
    at?: Position,
  ) {
    if (cmd.scope !== 'selection' && !cmd.keepsSelectionMode)
      selection.setMode(false);
    const title = (choice ?? cmd).toast?.();
    if (choice) choice.execute();
    else if (at && cmd.executeAt) cmd.executeAt(at);
    else cmd.execute();
    if (title) actionToast(cmd.id, title, (choice ?? cmd).icon, cmd.undoable);
  }

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget);
    triggerRef(widgets);

    const shortcuts: Record<string, () => void> = {};
    for (const cmd of widget.commands)
      if (cmd.kbds)
        shortcuts[shortcutKey(cmd.kbds)] = () => {
          if (applies(cmd) && (cmd.shortcutGuard?.() ?? true)) run(cmd);
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
    kbds: commandKbds(cmd),
    onSelect: () => run(cmd),
    // The palette opens these as a page of their own.
    children: cmd.choices?.map((c) => ({
      label: c.label,
      icon: c.icon,
      onSelect: () => run(cmd, c),
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
            .filter(
              (c) => c.scope !== 'selection' && !c.shortcutOnly && applies(c),
            )
            .map(toItem),
        })),
    ].filter((g) => g.items.length),
  );

  return {
    register,
    unregister,
    run,
    allCommands,
    selectionCommands,
    paletteGroups,
  };
});
