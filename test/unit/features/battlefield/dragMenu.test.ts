import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDragMenu,
  DRAG_MENU_DELAY_MS,
} from '~/features/battlefield/dragMenu';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createDragMenu (#108)', () => {
  it('opens on a stack after the pointer stays over it for the delay', () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 1);
    expect(menu.target.value).toBeNull();
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(1);
    expect(menu.target.value).toBe('b');
  });

  it('restarts the wait when the pointer moves to another stack', () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 100);
    menu.move({ stackId: 'c' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 100);
    expect(menu.target.value).toBeNull();
    vi.advanceTimersByTime(100);
    expect(menu.target.value).toBe('c');
  });

  it('cancels the wait when the pointer leaves the stack', () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 100);
    menu.move({});
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
    expect(menu.target.value).toBeNull();
  });

  it("doesn't open for a drag that isn't eligible", () => {
    const menu = createDragMenu();
    menu.start(false);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
    expect(menu.target.value).toBeNull();
  });

  it('tracks the hovered option and returns it on drop', () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
    // Moving off the stack towards an option keeps the menu open.
    menu.move({});
    expect(menu.target.value).toBe('b');
    menu.move({ option: 'under' });
    expect(menu.hovered.value).toBe('under');
    expect(menu.end()).toEqual({ stackId: 'b', mode: 'under' });
    expect(menu.target.value).toBeNull();
    expect(menu.hovered.value).toBeNull();
  });

  it('returns nothing when dropped away from the options', () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
    menu.move({ option: 'attach' });
    menu.move({});
    expect(menu.end()).toBeNull();
    expect(menu.target.value).toBeNull();
  });

  it("doesn't open after the drag ends", () => {
    const menu = createDragMenu();
    menu.start(true);
    menu.move({ stackId: 'b' });
    menu.end();
    vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
    expect(menu.target.value).toBeNull();
  });
});
