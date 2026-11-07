import { describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import { useBlockBrowserZoom } from '~/composables/useBlockBrowserZoom';

/** Dispatches a cancelable Safari gesture event and reports if it was blocked. */
function gesture(target: EventTarget, type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useBlockBrowserZoom', () => {
  // #58: Safari zooms the page on a pinch unless its gesture events are
  // cancelled; touch-action alone doesn't stop it.
  it.each(['gesturestart', 'gesturechange', 'gestureend'])(
    'cancels %s on the target and its children',
    (type) => {
      const target = document.createElement('div');
      const child = target.appendChild(document.createElement('span'));
      const scope = effectScope();
      scope.run(() => useBlockBrowserZoom(ref(target)));

      expect(gesture(child, type)).toBe(true);
      scope.stop();
    },
  );

  it('leaves gestures elsewhere alone, and stops when its scope ends', () => {
    const target = document.createElement('div');
    const other = document.createElement('div');
    const scope = effectScope();
    scope.run(() => useBlockBrowserZoom(ref(target)));

    expect(gesture(other, 'gesturestart')).toBe(false);
    scope.stop();
    expect(gesture(target, 'gesturestart')).toBe(false);
  });
});
