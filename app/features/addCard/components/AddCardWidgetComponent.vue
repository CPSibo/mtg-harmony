<script setup lang="ts">
import { createAddCardWidget, useAddCard } from '..';
import { useWidgetRegistry } from '~/features/widgets';

const addCardStore = useAddCard();
const addCardWidget = createAddCardWidget(addCardStore);

const registry = useWidgetRegistry();
onMounted(() => registry.register(addCardWidget));
onUnmounted(() => registry.unregister(addCardWidget.id));
</script>
