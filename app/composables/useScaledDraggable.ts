import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useDraggable, type UseDraggableOptions } from '@vueuse/core';

export interface UseBoardDraggableOptions extends Omit<
  UseDraggableOptions,
  'containerElement'
> {
  containerElement?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  scale?: MaybeRefOrGetter<number>;
  snapScale?: MaybeRefOrGetter<number>;
}

export function useBoardDraggable(
  el: Parameters<typeof useDraggable>[0],
  options: UseBoardDraggableOptions = {},
) {
  const { scale = 1, snapScale = 0, containerElement, ...rest } = options;

  const s = () => toValue(scale) || 1;
  const snap = () => toValue(snapScale) ?? 0;

  const x = ref(toValue(options.initialValue)?.x ?? 0);
  const y = ref(toValue(options.initialValue)?.y ?? 0);

  let startPointerX = 0;
  let startPointerY = 0;
  let startX = 0;
  let startY = 0;

  function clamp(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
  }

  function snapTo(val: number, grid: number) {
    return grid > 0 ? Math.round(val / grid) * grid : val;
  }

  function getClampedPosition(rawX: number, rawY: number) {
    const containerEl = toValue(containerElement);
    const dragEl = toValue(el) as HTMLElement | null | undefined;

    if (!containerEl || !dragEl) return { x: rawX, y: rawY };

    const containerRect = containerEl.getBoundingClientRect();
    const dragRect = dragEl.getBoundingClientRect();

    const sc = s();
    const maxX = (containerRect.width - dragRect.width) / sc;
    const maxY = (containerRect.height - dragRect.height) / sc;

    const finalX = clamp(rawX, 0, Math.max(0, maxX));
    const finalY = clamp(rawY, 0, Math.max(0, maxY));

    return {
      x: finalX,
      y: finalY,
    };
  }

  const drag = useDraggable(el, {
    ...rest,
    containerElement: undefined,

    onStart(pos, event) {
      startPointerX = event.clientX;
      startPointerY = event.clientY;
      startX = x.value;
      startY = y.value;
      return rest.onStart?.(pos, event);
    },

    onMove(pos, event) {
      const rawX = snapTo(
        startX + (event.clientX - startPointerX) / s(),
        snap(),
      );
      const rawY = snapTo(
        startY + (event.clientY - startPointerY) / s(),
        snap(),
      );

      const clamped = getClampedPosition(rawX, rawY);
      x.value = clamped.x;
      y.value = clamped.y;

      rest.onMove?.(pos, event);
    },

    onEnd(pos, event) {
      // Use our scaled [x,y], instead of the naive positon.
      rest.onEnd?.({ x: x.value, y: y.value }, event);
    },
  });

  const style = computed(() => `left: ${x.value}px; top: ${y.value}px;`);

  return {
    ...drag,
    x,
    y,
    style,
  };
}
