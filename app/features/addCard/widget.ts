import type { WidgetDefinition } from '~/features/widgets';
import type { useAddCard } from '.';

export function createAddCardWidget(
  store: ReturnType<typeof useAddCard>,
): WidgetDefinition {
  return {
    id: 'addCard',
    label: 'Add Card',
    icon: 'i-lucide-plus',

    commands: [
      {
        id: 'addCard.open',
        label: 'Add card to battlefield',
        icon: 'i-lucide-plus',
        kbds: 'b-a',
        execute: store.openAddCardWindow,
      },
    ],
  };
}
