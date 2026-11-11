import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDragToCast } from '~/composables/useDragToCast';
import { useBattlefieldStore } from '~/features/battlefield';

function pointer(
  type: string,
  x: number,
  y: number,
  target: Element,
  extra: Partial<PointerEventInit> = {},
): PointerEvent {
  const e = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    bubbles: true,
    ...extra,
  });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

describe('useDragToCast', () => {
  let source: HTMLElement;
  let boardEl: HTMLElement;

  beforeEach(() => {
    source = document.createElement('div');
    source.setPointerCapture = vi.fn();
    document.body.append(source);

    boardEl = document.createElement('div');
    boardEl.className = 'board-wrapper';
    document.body.append(boardEl);

    useBattlefieldStore().setTransform({ x: 100, y: 0, scale: 2 });
  });

  afterEach(() => {
    source.remove();
    boardEl.remove();
    vi.restoreAllMocks();
  });

  function drag(onDrop: (at: { x: number; y: number }) => void, over: Element) {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(over);
    const d = useDragToCast({ onDrop });
    d.onPointerDown(pointer('pointerdown', 0, 0, source));
    d.onPointerMove(pointer('pointermove', 300, 40, source));
    return d;
  }

  it('shows a ghost at the board card size once past the threshold', () => {
    const d = useDragToCast({ onDrop: vi.fn() });
    d.onPointerDown(pointer('pointerdown', 0, 0, source));
    d.onPointerMove(pointer('pointermove', 3, 0, source));
    expect(d.ghost.value).toBeNull();

    d.onPointerMove(pointer('pointermove', 30, 0, source));
    expect(d.ghost.value).toEqual({ x: 30, y: 0 });
    expect(d.ghostWidth.value).toBe(172 * 2);
  });

  it('drops at the board point under the pointer', () => {
    const onDrop = vi.fn();
    const d = drag(onDrop, boardEl);
    d.onPointerUp(pointer('pointerup', 300, 40, source));
    expect(onDrop).toHaveBeenCalledWith({ x: 100, y: 20 });
    expect(d.ghost.value).toBeNull();
  });

  it('cancels a drop off the board', () => {
    const onDrop = vi.fn();
    const d = drag(onDrop, source);
    d.onPointerUp(pointer('pointerup', 300, 40, source));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('treats a press without movement as a tap', () => {
    const onDrop = vi.fn();
    const d = useDragToCast({ onDrop });
    d.onPointerDown(pointer('pointerdown', 0, 0, source));
    d.onPointerUp(pointer('pointerup', 0, 0, source));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('swallows the click that follows a drag, but not a tap', () => {
    const clicked = vi.fn();
    source.addEventListener('click', clicked);

    const d = drag(vi.fn(), boardEl);
    d.onPointerUp(pointer('pointerup', 300, 40, source));
    source.click();
    expect(clicked).not.toHaveBeenCalled();

    d.onPointerDown(pointer('pointerdown', 0, 0, source));
    d.onPointerUp(pointer('pointerup', 0, 0, source));
    source.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('ignores presses other than the main button', () => {
    const d = useDragToCast({ onDrop: vi.fn() });
    d.onPointerDown(pointer('pointerdown', 0, 0, source, { button: 2 }));
    d.onPointerMove(pointer('pointermove', 30, 0, source));
    expect(d.ghost.value).toBeNull();
  });
});
