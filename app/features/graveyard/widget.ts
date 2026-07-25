import type { WidgetDefinition, WidgetSetting } from '~/features/widgets';
import type { useGraveyard } from '.';

export function createGraveyardWidget(
  store: ReturnType<typeof useGraveyard>,
): WidgetDefinition {
  return {
    id: 'graveyard',
    label: 'Graveyard',
    icon: 'i-lucide-skull',

    commands: [
      {
        id: 'graveyard.toggle',
        label: 'Toggle graveyard window',
        icon: 'i-lucide-skull',
        kbds: 'g-g',
        execute: store.openGraveyardWindow,
      },

      {
        id: 'graveyard.addCard',
        label: 'Add card to graveyard',
        icon: 'i-lucide-circle-plus',
        kbds: 'g-a',
        execute: store.openAddCardToGraveyardWindow,
      },

      {
        id: 'graveyard.removeAllCards',
        label: 'Clear graveyard',
        icon: 'i-lucide-circle-x',
        kbds: 'g-c',
        execute: store.removeAllCards,
      },
    ],

    settings: [
      {
        id: 'graveyard.removeCounters',
        label: 'Remove counters',
        description: 'Remove counters when cards enter the graveyard',
        type: 'boolean',
        value: () => store.removeCounters,
        set: (v) => {
          store.removeCounters = v;
        },
      } satisfies WidgetSetting<boolean>,
    ],
  };
}
