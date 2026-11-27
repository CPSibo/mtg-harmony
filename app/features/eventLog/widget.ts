import type { WidgetDefinition } from '~/features/widgets';
import type { useEventLogStore } from '.';

export function createEventLogWidget(
  store: ReturnType<typeof useEventLogStore>,
): WidgetDefinition {
  return {
    id: 'eventLog',
    label: 'Event Log',
    icon: 'i-lucide-scroll-text',
    order: 70,
    hideWithSelection: true,

    commands: [
      {
        id: 'eventLog.open',
        label: 'Open event log',
        icon: 'i-lucide-scroll-text',
        kbds: 'e-l',
        execute: store.openWindow,
      },
    ],
  };
}
