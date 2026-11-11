import { useEventListener } from '@vueuse/core';
import { toValue, type MaybeRefOrGetter, type Ref } from 'vue';

/**
 * Closes a non-modal window when a touch lands outside `content` (#135).
 *
 * Reka (under `UModal`) only dismisses on touch once the tap's `click`
 * arrives, and the board cancels `touchstart` to pan, so that click never
 * comes. A plain tap anywhere outside, on the board or a card stack, should
 * still close the window. Listening on the document in the capture phase
 * runs before any element's own handlers, so none of them can swallow it.
 * Mouse presses are left to Reka, which handles them already.
 */
export function useCloseOnTouchOutside(
  open: Ref<boolean | undefined>,
  content: MaybeRefOrGetter<Element | null | undefined>,
) {
  useEventListener(
    document,
    'pointerdown',
    (e: PointerEvent) => {
      if (!open.value || e.pointerType !== 'touch') return;
      const el = toValue(content);
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      open.value = false;
    },
    { capture: true, passive: true },
  );
}
