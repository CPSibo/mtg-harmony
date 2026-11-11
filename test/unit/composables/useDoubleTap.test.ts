import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useDoubleTap } from '~/composables/useDoubleTap';

function pointer(
  target: EventTarget,
  type: string,
  x = 0,
  y = 0,
  pointerType = 'touch',
) {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(event, { clientX: x, clientY: y, pointerType });
  target.dispatchEvent(event);
}

function tap(target: EventTarget, x = 0, y = 0, pointerType = 'touch') {
  pointer(target, 'pointerdown', x, y, pointerType);
  pointer(target, 'pointerup', x, y, pointerType);
}

function setup() {
  const target = document.createElement('div');
  const handler = vi.fn();
  const scope = effectScope();
  scope.run(() => useDoubleTap(ref(target), handler));
  return { target, handler, scope };
}

describe('useDoubleTap', () => {
  // iOS fires no dblclick when touchstart is cancelled (the board does, to pan).
  it('fires on two quick touch taps', () => {
    const { target, handler, scope } = setup();
    tap(target);
    expect(handler).not.toHaveBeenCalled();
    tap(target, 5, 5);
    expect(handler).toHaveBeenCalledOnce();
    scope.stop();
  });

  it('ignores slow taps', () => {
    vi.useFakeTimers();
    const { target, handler, scope } = setup();
    tap(target);
    vi.advanceTimersByTime(500);
    tap(target);
    expect(handler).not.toHaveBeenCalled();
    scope.stop();
    vi.useRealTimers();
  });

  it('ignores drags and far-apart taps', () => {
    const { target, handler, scope } = setup();
    pointer(target, 'pointerdown', 0, 0);
    pointer(target, 'pointerup', 50, 0);
    tap(target, 50, 0);
    expect(handler).not.toHaveBeenCalled();
    tap(target, 100, 0);
    tap(target, 200, 0);
    expect(handler).not.toHaveBeenCalled();
    scope.stop();
  });

  it('uses dblclick for the mouse', () => {
    const { target, handler, scope } = setup();
    tap(target, 0, 0, 'mouse');
    tap(target, 0, 0, 'mouse');
    expect(handler).not.toHaveBeenCalled();
    target.dispatchEvent(new MouseEvent('dblclick'));
    expect(handler).toHaveBeenCalledOnce();
    scope.stop();
  });

  // Android fires dblclick for a touch double tap too.
  it('ignores dblclick after touch, so it fires once', () => {
    const { target, handler, scope } = setup();
    tap(target);
    tap(target);
    target.dispatchEvent(new MouseEvent('dblclick'));
    expect(handler).toHaveBeenCalledOnce();
    scope.stop();
  });

  // The second tap's click must not hit what the handler just opened (#140).
  it('swallows the click that follows a touch double tap', () => {
    const { target, scope } = setup();
    const button = document.createElement('button');
    document.body.append(button);
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    tap(target);
    tap(target);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    button.click();
    expect(onClick).toHaveBeenCalledOnce();

    button.remove();
    scope.stop();
  });

  it('stops swallowing clicks when none follows soon', () => {
    vi.useFakeTimers();
    const { target, scope } = setup();
    const button = document.createElement('button');
    document.body.append(button);
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    tap(target);
    tap(target);
    vi.advanceTimersByTime(1000);
    button.click();
    expect(onClick).toHaveBeenCalledOnce();

    button.remove();
    scope.stop();
    vi.useRealTimers();
  });

  it('does not fire a third tap as a second double tap', () => {
    const { target, handler, scope } = setup();
    tap(target);
    tap(target);
    tap(target);
    expect(handler).toHaveBeenCalledOnce();
    scope.stop();
  });
});
