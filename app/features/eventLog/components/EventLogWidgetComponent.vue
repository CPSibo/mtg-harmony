<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { createEventLogWidget, useEventLogStore } from '..';
import { useWidgetRegistry } from '~/features/widgets';

const widget = createEventLogWidget(useEventLogStore());

const registry = useWidgetRegistry();
onMounted(() => registry.register(widget));
onUnmounted(() => registry.unregister(widget.id));
</script>
