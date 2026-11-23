import type { useBattlefieldStore } from '~/features/battlefield';
import type { Position } from '@vueuse/core';
import type { BoardCard, BoardCardStack } from '~/types/PlayArea';
import { randomUUID } from '~/utils/randomUUID';

/**
 * Puts `card` on the board in a stack of its own, at `position` (the board's
 * centre by default), in front, without logging. The store keeps this step
 * private: the app always goes through a logged action such as `castCard`.
 * Returns the store's reactive copy of the new stack.
 */
export function putOnBoard(
  board: ReturnType<typeof useBattlefieldStore>,
  card: BoardCard,
  position: Position = board.center,
): BoardCardStack {
  const stack: BoardCardStack = {
    id: randomUUID(),
    primary: card,
    attachments: new Set<BoardCard>(),
    unders: new Set<BoardCard>(),
    position: { ...position },
  };
  card.stack = stack;
  board.stacks.push(stack);
  board.bringToFront(stack);
  return board.stacks.at(-1)!;
}
