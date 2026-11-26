import { describe, expect, it } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield';

describe('toggleSnapping (#218)', () => {
  it('turns snapping off, then back on at the size it had', () => {
    const board = useBattlefieldStore();
    board.snapScale = 25;

    board.toggleSnapping();
    expect(board.snapScale).toBe(0);

    board.toggleSnapping();
    expect(board.snapScale).toBe(25);
  });

  it('turns snapping on at the default size when it was never on', () => {
    const board = useBattlefieldStore();
    board.snapScale = 0;

    board.toggleSnapping();
    expect(board.snapScale).toBe(10);
  });
});
