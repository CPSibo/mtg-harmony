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
    // Moving off the card towards an option, inside the menu's area.
    menu.move({ inArea: true });
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

  it('reads the delay when each hover starts', () => {
    let delay = 500;
    const menu = createDragMenu(() => delay);
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(500);
    expect(menu.target.value).toBe('b');

    delay = 1500;
    menu.start(true);
    menu.move({ stackId: 'b' });
    vi.advanceTimersByTime(1000);
    expect(menu.target.value).toBeNull();
    vi.advanceTimersByTime(500);
    expect(menu.target.value).toBe('b');
  });

  describe('leaving the menu (#108)', () => {
    function openOn(menu: ReturnType<typeof createDragMenu>, stackId: string) {
      menu.start(true);
      menu.move({ stackId });
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.target.value).toBe(stackId);
    }

    it('closes after the pointer stays outside its area for the delay', () => {
      const menu = createDragMenu();
      openOn(menu, 'b');
      menu.move({});
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 1);
      expect(menu.target.value).toBe('b');
      vi.advanceTimersByTime(1);
      expect(menu.target.value).toBeNull();
      expect(menu.end()).toBeNull();
    });

    it('stays open when the pointer comes back in time', () => {
      const menu = createDragMenu();
      openOn(menu, 'b');
      menu.move({});
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 100);
      menu.move({ option: 'attach', inArea: true });
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.target.value).toBe('b');
      menu.move({});
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS - 100);
      menu.move({ inArea: true });
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.target.value).toBe('b');
    });

    it('clears the hovered option when it closes', () => {
      const menu = createDragMenu();
      openOn(menu, 'b');
      menu.move({ option: 'under', inArea: true });
      menu.move({});
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.hovered.value).toBeNull();
    });

    it('opens around another card the pointer moved to and stayed on', () => {
      const menu = createDragMenu();
      openOn(menu, 'b');
      menu.move({ stackId: 'c' });
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.target.value).toBeNull();
      // Held still over c: no more moves arrive, but it still opens there.
      vi.advanceTimersByTime(DRAG_MENU_DELAY_MS);
      expect(menu.target.value).toBe('c');
    });
  });
});
