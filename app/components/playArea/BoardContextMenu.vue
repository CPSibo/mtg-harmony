<template>
  <!-- The board decides when the menu opens (see `createMenuGesture`), then
       opens it here at a point. The trigger is a hidden point of its own:
       made the board, Reka's own long press would fight the pan. Reka puts
       its own ref on the trigger, so ours goes on the element around it. -->
  <div
    ref="anchor"
    class="board-menu-anchor"
    aria-hidden="true"
  >
    <UContextMenu
      :items="items"
      :size="menuSize"
      :ui="menuUi"
    >
      <span class="board-menu-trigger" />
    </UContextMenu>
  </div>
</template>

<script setup lang="ts">
import UContextMenu from '@nuxt/ui/components/ContextMenu.vue';
import type { Position } from '@vueuse/core';
import { computed, useTemplateRef } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { boardMenuGroups } from '~/features/battlefield/contextMenu';
import {
  commandKbds,
  commandLabel,
  useWidgetRegistry,
} from '~/features/widgets';
import { useSmallScreen } from '~/composables/useSmallScreen';
import { useInputModeStore } from '~/stores/inputMode';

const battlefield = useBattlefieldStore();
const registry = useWidgetRegistry();
const inputMode = useInputModeStore();
const smallScreen = useSmallScreen();

// Big enough for a finger, as the selection bar's menus (#237).
const bigMenus = computed(() => inputMode.isTouch || smallScreen.value);
const menuSize = computed(() => (bigMenus.value ? 'xl' : 'md'));
const menuUi = computed(() => (bigMenus.value ? { item: 'py-3' } : {}));

const anchor = useTemplateRef('anchor');

/** The board point the menu opened at, for Cast here. Read only on select. */
let at: Position | undefined;

const items = computed(() =>
  boardMenuGroups(registry.allCommands).map((group) =>
    group.map(({ cmd, label }) => ({
      label: label ?? commandLabel(cmd),
      icon: cmd.icon,
      kbds: commandKbds(cmd),
      onSelect: () => registry.run(cmd, undefined, at),
    })),
  ),
);

/** Opens the menu at a screen point. */
function open(screen: Position) {
  at = battlefield.boardPointFromScreen(screen) ?? undefined;
  // Reka opens a context menu where its `contextmenu` event says.
  anchor.value?.firstElementChild?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: screen.x,
      clientY: screen.y,
    }),
  );
}

defineExpose({ open });
</script>

<style scoped>
.board-menu-anchor {
  position: fixed;
  inset: 0 auto auto 0;
  width: 0;
  height: 0;
}

.board-menu-trigger {
  display: block;
  width: 0;
  height: 0;
}
</style>
