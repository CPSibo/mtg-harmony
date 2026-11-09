import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useBoardDraggable } from '~/composables/useScaledDraggable';

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    bubbles: true,
  });
}

function setup(options: Parameters<typeof useBoardDraggable>[1] = {}) {
  const el = document.createElement('div');
  document.body.append(el);
  const scope = effectScope();
  const drag = scope.run(() =>
    useBoardDraggable(el, { initialValue: { x: 100, y: 50 }, ...options }),
  )!;
  return { el, drag, scope };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useBoardDraggable', () => {
  // #103: every stack used to listen to every pointer move on the window.
  it('listens on the window only while a drag is under way', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const moveListeners = () =>
      add.mock.calls.filter(([t]) => t === 'pointermove').length -
      remove.mock.calls.filter(([t]) => t === 'pointermove').length;

    const { el, scope } = setup();
    expect(moveListeners()).toBe(0);

    el.dispatchEvent(pointer('pointerdown', 10, 10));
    expect(moveListeners()).toBe(1);

    window.dispatchEvent(pointer('pointerup', 10, 10));
    expect(moveListeners()).toBe(0);
    scope.stop();
  });

  it('moves by the pointer distance divided by the scale, then reports the end', () => {
    const onEnd = vi.fn();
    const { el, drag, scope } = setup({ scale: 2, onEnd });

    el.dispatchEvent(pointer('pointerdown', 10, 10));
    expect(drag.isDragging.value).toBe(true);
    window.dispatchEvent(pointer('pointermove', 50, 30));
    expect([drag.x.value, drag.y.value]).toEqual([120, 60]);
    window.dispatchEvent(pointer('pointerup', 50, 30));

    expect(drag.isDragging.value).toBe(false);
    expect(onEnd).toHaveBeenCalledWith({ x: 120, y: 60 }, expect.anything());
    scope.stop();
  });

  it('snaps to the grid', () => {
    const { el, drag, scope } = setup({ snapScale: 10 });

    el.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointermove', 13, 26));

    expect([drag.x.value, drag.y.value]).toEqual([110, 80]);
    scope.stop();
  });

  // #116: the card sits inside the stack, offset by its action buttons.
  it('snaps the offset point, not the element origin, to the grid', () => {
    const { el, drag, scope } = setup({
      snapScale: 20,
      snapOffset: () => ({ x: 29, y: 7 }),
    });

    el.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointermove', 13, 26));

    // 100 + 13 + 29 = 142 → 140; 50 + 26 + 7 = 83 → 80.
    expect([drag.x.value, drag.y.value]).toEqual([111, 73]);
    scope.stop();
  });

  it("doesn't start while disabled", () => {
    const { el, drag, scope } = setup({ disabled: () => true });

    el.dispatchEvent(pointer('pointerdown', 0, 0));

    expect(drag.isDragging.value).toBe(false);
    scope.stop();
  });
  it('reports the start and each move of a drag (#108)', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const { el, scope } = setup({ onStart, onMove });

    el.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointermove', 5, 5));
    window.dispatchEvent(pointer('pointermove', 9, 9));
    window.dispatchEvent(pointer('pointerup', 9, 9));
    window.dispatchEvent(pointer('pointermove', 20, 20));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledTimes(2);
    scope.stop();
  });
});
