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
});
