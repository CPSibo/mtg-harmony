import type { WidgetDefinition, WidgetSetting } from "~/types/Widgets";

export function createGraveyardWidget(
  store: ReturnType<typeof useGraveyard>,
  ui: { toggleOpen: () => void }, // UI concerns injected in
): WidgetDefinition {
  const commands

  return {
    id: 'graveyard',
    label: 'Graveyard',
    icon: 'i-lucide-skull',
    commands: [
      {
        id: 'graveyard.toggle',
        label: 'Toggle graveyard window',
        icon: 'i-lucide-skull',
        kbds: ['g-g'],
        execute: ui.toggleOpen,
      },
      {
        id: 'graveyard.clear',
        label: 'Clear graveyard',
        icon: 'i-lucide-circle-x',
        kbds: ['g-c'],
        execute: () => store.removeAllCards(),
      },
    ],
    settings: [
      {
        id: 'graveyard.removeCounters',
        label: 'Remove counters on death',
        description: 'Strip modifiers when cards enter the graveyard',
        type: 'boolean',
        value: () => store.removeCounters,
        set: (v) => {
          store.removeCounters = v;
        },
      } satisfies WidgetSetting<boolean>,
    ],
  };
}
