import { onMounted, onUnmounted } from 'vue';
import { useWidgetRegistry } from './store';
import type { WidgetDefinition } from './types';

/**
 * Registers a widget's commands while the calling component is mounted, so
 * commands can call into that component (its windows, its state).
 */
export function useWidget(widget: WidgetDefinition) {
  const registry = useWidgetRegistry();
  onMounted(() => registry.register(widget));
  onUnmounted(() => registry.unregister(widget.id));
}
