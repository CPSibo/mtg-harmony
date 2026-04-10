<script setup lang="ts">
import { createGraveyardWidget, useGraveyard } from '..';
import { useWidgetRegistry } from '~/features/widgets';

const graveyardStore = useGraveyard();
const graveyardWidget = createGraveyardWidget(graveyardStore);

const registry = useWidgetRegistry();
onMounted(() => registry.register(graveyardWidget));
onUnmounted(() => registry.unregister(graveyardWidget.id));
</script>
