import { describe, expect, it } from 'vitest';
import { effectScope } from 'vue';
import { usePanAndZoom } from '~/composables/usePanAndZoom';

function setup() {
  const scope = effectScope();
  const pz = scope.run(() =>
    usePanAndZoom({ size: { width: 5000, height: 5000 } }),
  )!;
  return pz;
}

// Plain objects: happy-dom's event classes leave some fields unset.
const mouse = (x: number, y: number) =>
  ({ clientX: x, clientY: y, button: 0, preventDefault() {} }) as MouseEvent;
const wheel = (x: number, y: number) =>
  ({
    clientX: x,
    clientY: y,
    deltaY: -100,
    deltaMode: 0,
    ctrlKey: false,
    preventDefault() {},
  }) as WheelEvent;

/** The board point under a screen point. */
const boardPoint = (pz: ReturnType<typeof setup>, x: number, y: number) => ({
  x: (x - pz.position.value.x) / pz.scale.value,
  y: (y - pz.position.value.y) / pz.scale.value,
});

describe('usePanAndZoom', () => {
  it('keeps the point under the cursor fixed when zooming after a pan', () => {
    const pz = setup();
    pz.onMouseDown(mouse(400, 300));
    pz.onMouseMove(mouse(300, 200));
    pz.onMouseUp(mouse(300, 200));

    for (let i = 0; i < 3; i++) {
      const before = boardPoint(pz, 500, 400);
      pz.onWheel(wheel(500, 400));
      const after = boardPoint(pz, 500, 400);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });

  describe('touch', () => {
    const touch = (id: number, x: number, y: number) =>
      ({ identifier: id, clientX: x, clientY: y }) as Touch;
    const touchEvent = (...changed: Touch[]) => {
      let prevented = false;
      const e = {
        changedTouches: changed,
        preventDefault() {
          prevented = true;
        },
      } as unknown as TouchEvent;
      return { e, prevented: () => prevented };
    };

    // The board listens to touchend passively, so the browser can still
    // synthesise clicks; preventDefault there only logs an error.
    it('does not cancel touchend', () => {
      const pz = setup();
      pz.onTouchStart(touchEvent(touch(1, 0, 0)).e);
      const end = touchEvent(touch(1, 0, 0));
      pz.onTouchEnd(end.e);
      expect(end.prevented()).toBe(false);
    });

    it('forgets a cancelled touch, so the next one pans', () => {
      const pz = setup();
      pz.onTouchStart(touchEvent(touch(1, 0, 0)).e);
      pz.onTouchCancel(touchEvent(touch(1, 0, 0)).e);

      const start = { ...pz.position.value };
      const scale = pz.scale.value;
      pz.onTouchStart(touchEvent(touch(2, 100, 100)).e);
      pz.onTouchMove(touchEvent(touch(2, 150, 120)).e);
      pz.onTouchEnd(touchEvent(touch(2, 150, 120)).e);
      expect(pz.scale.value).toBe(scale);
      expect(pz.position.value.x).not.toBe(start.x);
    });
  });
});
