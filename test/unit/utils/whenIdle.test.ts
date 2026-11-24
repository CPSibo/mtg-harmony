import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_FALLBACK_MS, whenIdle } from '~/utils/whenIdle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('whenIdle', () => {
  it('uses requestIdleCallback where the browser has it', () => {
    const ric = vi.fn();
    vi.stubGlobal('requestIdleCallback', ric);
    const fn = vi.fn();

    whenIdle(fn);

    expect(ric).toHaveBeenCalledOnce();
    ric.mock.calls[0]![0]();
    expect(fn).toHaveBeenCalledOnce();
  });

  // #164: Safari has no requestIdleCallback, so nothing preloaded on iOS.
  it('falls back to a timeout without requestIdleCallback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const fn = vi.fn();

    whenIdle(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(IDLE_FALLBACK_MS);

    expect(fn).toHaveBeenCalledOnce();
  });
});
