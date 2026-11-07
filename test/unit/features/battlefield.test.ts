import { stringify } from 'devalue';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCardModifier, BoardCardStack } from '~/types/PlayArea';
import { makeCard, makeScryfallCard } from '../fixtures/cards';
import { stubStorage } from '../fixtures/storage';

const STORAGE_KEY = 'mtg-harmony_battlefield';

function names(stacks: BoardCardStack[]) {
  return stacks.map((s) => s.primary.name);
}

/** A board with a "Host" stack carrying `count` attachments named "Aura N". */
function boardWithAttachments(count: number) {
  const board = useBattlefieldStore();
  board.setCenter({ x: 1000, y: 1000 });
  board.addStackByCard(makeCard({ name: 'Host' }));
  for (let i = 0; i < count; i++) {
    board.addStackByCard(makeCard({ name: `Aura ${i}` }));
    board.startAttaching(board.stacks[1]!.primary);
    board.finishAttaching(board.stacks[0]!);
  }
  return board;
}

/** A board with a "Host" stack that has `count` unders named "Under N". */
function boardWithUnders(count: number) {
  const board = useBattlefieldStore();
  board.setCenter({ x: 1000, y: 1000 });
  board.addStackByCard(makeCard({ name: 'Host' }));
  const host = board.stacks[0]!;
  for (let i = 0; i < count; i++) {
    const under = makeCard({ name: `Under ${i}` });
    host.unders.add(under);
    under.stack = host;
  }
  return board;
}

describe('battlefield store', () => {
  describe('adding and removing stacks', () => {
    it('adds a stack at the board centre and links the card to it', () => {
      const board = useBattlefieldStore();
      board.setCenter({ x: 40, y: 60 });

      board.addStackByCard(makeCard({ name: 'New' }));

      const stack = board.stacks[0]!;
      expect(names(board.stacks)).toEqual(['New']);
      expect(stack.primary.stack).toBe(stack);
      expect(stack.position).toEqual({ x: 40, y: 60 });
      expect(board.orderedStacks.map((s) => s.id)).toEqual([stack.id]);
    });

    it('copies the centre, so moving the board later leaves the stack put', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());

      board.setCenter({ x: 999, y: 999 });

      expect(board.stacks[0]!.position).toEqual({ x: 0, y: 0 });
    });

    it('gives every stack its own ID', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());
      board.addStackByCard(makeCard());

      expect(board.stacks[0]!.id).not.toBe(board.stacks[1]!.id);
    });

    // #23: adding the same token twice used to give both copies one ID.
    it('casts a fresh card each time, even from the same Scryfall card', () => {
      const board = useBattlefieldStore();
      const scryfallCard = makeScryfallCard({ name: 'Goblin' });

      const a = board.castCard(scryfallCard);
      const b = board.castCard(scryfallCard);

      expect(names(board.stacks)).toEqual(['Goblin', 'Goblin']);
      expect(a.primary).not.toBe(b.primary);
      expect(a.primary.id).not.toBe(b.primary.id);
      expect(a.primary.stack).toBe(a);
      expect(b.primary.stack).toBe(b);

      board.toggleTapped(a.primary);
      expect(b.primary.tapped).toBe(false);
    });

    it('removes a stack and its z-order entry', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'Keep' }));
      board.addStackByCard(makeCard({ name: 'Drop' }));
      const [keep, drop] = board.stacks as [BoardCardStack, BoardCardStack];

      expect(board.removeStack(drop)).toBe(true);

      expect(names(board.stacks)).toEqual(['Keep']);
      expect(board.orderedStacks.map((s) => s.id)).toEqual([keep.id]);
      expect(board.removeStack(drop)).toBe(false);
    });

    it('clears every stack', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());
      board.addStackByCard(makeCard());

      board.clearStacks();

      expect(board.stacks).toEqual([]);
      expect(board.orderedStacks).toEqual([]);
    });
  });

  describe('z-order', () => {
    it('orders stacks by when they were added', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'A' }));
      board.addStackByCard(makeCard({ name: 'B' }));
      board.addStackByCard(makeCard({ name: 'C' }));

      expect(names(board.orderedStacks)).toEqual(['A', 'B', 'C']);
    });

    it('brings a stack to the front without reordering the stacks array', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'A' }));
      board.addStackByCard(makeCard({ name: 'B' }));
      board.addStackByCard(makeCard({ name: 'C' }));

      board.bringToFront(board.stacks[0]!);

      expect(names(board.orderedStacks)).toEqual(['B', 'C', 'A']);
      expect(names(board.stacks)).toEqual(['A', 'B', 'C']);
    });

    it('leaves the order alone when the stack is already in front', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'A' }));
      board.addStackByCard(makeCard({ name: 'B' }));

      board.bringToFront(board.stacks[1]!);

      expect(names(board.orderedStacks)).toEqual(['A', 'B']);
    });
  });

  describe('attaching', () => {
    it('moves a card from its own stack onto another stack', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'Host' }));
      board.addStackByCard(makeCard({ name: 'Aura' }));
      const aura = board.stacks[1]!.primary;

      board.startAttaching(aura);
      expect(board.isAttaching).toBe(true);
      board.finishAttaching(board.stacks[0]!);

      const host = board.stacks[0]!;
      expect(names(board.stacks)).toEqual(['Host']);
      expect([...host.attachments].map((c) => c.name)).toEqual(['Aura']);
      expect([...host.attachments][0]!.stack).toBe(host);
      expect(board.isAttaching).toBe(false);
    });

    it('cancels attaching', () => {
      const board = useBattlefieldStore();
      board.startAttaching(makeCard());

      board.cancelAttaching();

      expect(board.isAttaching).toBe(false);
    });

    it('refuses to finish without a card, onto itself, or twice', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard({ name: 'Host' }));
      board.addStackByCard(makeCard({ name: 'Aura' }));
      const host = board.stacks[0]!;
      const aura = board.stacks[1]!.primary;

      expect(() => board.finishAttaching(host)).toThrow('Source card not set.');

      board.startAttaching(host.primary);
      expect(() => board.finishAttaching(host)).toThrow(
        'Cannot attach a card to itself.',
      );

      board.startAttaching(aura);
      board.finishAttaching(host);
      board.startAttaching(aura);
      expect(() => board.finishAttaching(host)).toThrow(
        'already belongs to target stack as attachment',
      );
    });

    it('accepts only other stacks’ primary cards as targets', () => {
      const board = boardWithAttachments(1); // Host with Aura 0.
      board.addStackByCard(makeCard({ name: 'Other' }));
      board.addStackByCard(makeCard({ name: 'Equipment' }));
      const [host, other, equipment] = board.stacks as BoardCardStack[];
      const aura = [...host!.attachments][0]!;

      expect(board.isValidAttadchmentTarget(other!.primary)).toBe(false); // Not attaching.

      board.startAttaching(equipment!.primary);
      expect(board.isValidAttadchmentTarget(other!.primary)).toBe(true);
      expect(board.isValidAttadchmentTarget(host!.primary)).toBe(true);
      expect(board.isValidAttadchmentTarget(equipment!.primary)).toBe(false); // Itself.
      expect(board.isValidAttadchmentTarget(aura)).toBe(false); // Not a primary.
    });

    it('detaches a card into a new stack of its own', () => {
      const board = boardWithAttachments(1);

      board.detach([...board.stacks[0]!.attachments][0]!);

      expect(names(board.stacks)).toEqual(['Host', 'Aura 0']);
      expect(board.stacks[0]!.attachments.size).toBe(0);
      expect(board.stacks[1]!.primary.stack).toBe(board.stacks[1]);
    });

    it('does not detach a primary card', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());

      board.detach(board.stacks[0]!.primary);

      expect(board.stacks).toHaveLength(1);
    });
  });

  describe('removing cards from stacks', () => {
    it('removes an attachment', () => {
      const board = boardWithAttachments(1);
      const aura = [...board.stacks[0]!.attachments][0]!;

      expect(board.removeCardFromStack(aura)).toBe(true);

      expect(board.stacks[0]!.attachments.size).toBe(0);
      expect(names(board.stacks)).toEqual(['Host']);
    });

    it('removes an under', () => {
      const board = boardWithUnders(1);
      const under = [...board.stacks[0]!.unders][0]!;

      expect(board.removeCardFromStack(under)).toBe(true);

      expect(board.stacks[0]!.unders.size).toBe(0);
    });

    it('splits attachments into new stacks when the primary card is removed', () => {
      const board = boardWithAttachments(2);

      const result = board.removeCardFromStack(board.stacks[0]!.primary);

      expect(names(board.stacks)).toEqual(['Aura 0', 'Aura 1']);
      expect(result).toEqual(board.stacks);
    });

    it('returns false for a card that is on no stack', () => {
      const board = useBattlefieldStore();

      expect(board.removeCardFromStack(makeCard())).toBe(false);
    });
  });

  describe('exploding a stack', () => {
    it('lays attachments out in a centred row below the stack', () => {
      const board = boardWithAttachments(3);
      const host = board.stacks[0]!;

      const { primaryStack, attachmentStacks } = board.explodeStack(host);

      expect(primaryStack).toBe(host);
      expect(host.attachments.size).toBe(0);
      expect(attachmentStacks.map((s) => s.position)).toEqual([
        { x: 800, y: 1240 },
        { x: 1000, y: 1240 },
        { x: 1200, y: 1240 },
      ]);
    });

    it('lays unders out in a second row', () => {
      const board = boardWithUnders(2);

      const { underStacks } = board.explodeStack(board.stacks[0]!);

      expect(names(underStacks)).toEqual(['Under 0', 'Under 1']);
      expect(underStacks.map((s) => s.position.y)).toEqual([1480, 1480]);
    });

    // #26: the unders row is centred using the attachment count.
    it.fails('centres the unders row on the stack (#26)', () => {
      const board = boardWithUnders(2);

      const { underStacks } = board.explodeStack(board.stacks[0]!);

      expect(underStacks.map((s) => s.position.x)).toEqual([900, 1100]);
    });
  });

  describe('card state', () => {
    it('untaps every primary and attachment', () => {
      const board = boardWithAttachments(1);
      board.addStackByCard(makeCard({ name: 'Other' }));
      const cards = board.stacks.flatMap((s) => [s.primary, ...s.attachments]);
      for (const card of cards) card.tapped = true;

      board.untapAll();

      expect(cards.map((c) => c.tapped)).toEqual([false, false, false]);
    });

    it('toggles tapped', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());
      const card = board.stacks[0]!.primary;

      board.toggleTapped(card);
      expect(card.tapped).toBe(true);
      board.toggleTapped(card);
      expect(card.tapped).toBe(false);
    });

    it('sets the face number', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());
      const card = board.stacks[0]!.primary;

      board.setFaceNumber(card, 3);

      expect(card.faceNumber).toBe(3);
    });

    it('clears modifiers', () => {
      const board = useBattlefieldStore();
      const flying: BoardCardModifier = {
        modifier: { name: 'Flying', symbol: 'ms ms-ability-flying' },
        count: 1,
      };
      board.addStackByCard(makeCard({ modifiers: new Set([flying]) }));
      const card = board.stacks[0]!.primary;

      board.clearModifiers(card);

      expect(card.modifiers.size).toBe(0);
    });

    it('moves a stack', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());

      board.setStackPosition(board.stacks[0]!, { x: 12, y: 34 });

      expect(board.stacks[0]!.position).toEqual({ x: 12, y: 34 });
    });
  });

  describe('reset', () => {
    it('restores the default board', () => {
      const board = useBattlefieldStore();
      board.addStackByCard(makeCard());
      board.setCenter({ x: 5, y: 5 });
      board.setsnapScale(25);
      board.startAttaching(makeCard());

      board.reset();

      expect(board.stacks).toEqual([]);
      expect(board.center).toEqual({ x: 0, y: 0 });
      expect(board.snapScale).toBe(10);
      expect(board.isAttaching).toBe(false);
    });
  });

  describe('persistence', () => {
    it('saves changes and loads them back', async () => {
      vi.useFakeTimers();
      const board = boardWithAttachments(1);
      board.setCenter({ x: 7, y: 8 });
      await nextTick();
      vi.runAllTimers();

      board.clearStacks();
      board.setCenter({ x: 0, y: 0 });
      expect(board.load()).toBe(true);

      const host = board.stacks[0]!;
      expect(names(board.stacks)).toEqual(['Host']);
      expect([...host.attachments].map((c) => c.name)).toEqual(['Aura 0']);
      // devalue keeps the card <-> stack cycle intact.
      expect(host.primary.stack).toBe(host);
      expect(board.center).toEqual({ x: 7, y: 8 });
    });

    it('rebuilds a saved z-order that lost or gained IDs', () => {
      const stacks = ['A', 'B'].map((name, i) => {
        const card = makeCard({ name });
        const stack: BoardCardStack = {
          id: `stack-${i}`,
          primary: card,
          attachments: new Set(),
          unders: new Set(),
          position: { x: 0, y: 0 },
        };
        card.stack = stack;
        return stack;
      });
      localStorage.setItem(
        STORAGE_KEY,
        stringify({
          stacks,
          zOrder: ['gone', 'stack-1'],
          center: { x: 0, y: 0 },
          snapScale: 10,
        }),
      );

      const board = useBattlefieldStore();

      expect(names(board.orderedStacks)).toEqual(['B', 'A']);
    });

    // #23: boards saved before the fix use Scryfall IDs for cards, and a
    // history card cast twice is one object on two stacks.
    it('gives saved cards with shared or Scryfall IDs their own', () => {
      const shared = makeCard({ name: 'Twice' });
      shared.id = shared.scryfallInfo.id;
      const aura = makeCard({ name: 'Aura', id: 'dup' });
      const under = makeCard({ name: 'Under', id: 'dup' });
      const stacks = [0, 1].map((i) => {
        const stack: BoardCardStack = {
          id: `stack-${i}`,
          primary: shared,
          attachments: new Set(i === 0 ? [aura] : []),
          unders: new Set(i === 1 ? [under] : []),
          position: { x: 0, y: 0 },
        };
        shared.stack = stack;
        return stack;
      });
      aura.stack = stacks[0];
      under.stack = stacks[1];
      localStorage.setItem(
        STORAGE_KEY,
        stringify({
          stacks,
          zOrder: [],
          center: { x: 0, y: 0 },
          snapScale: 10,
        }),
      );

      const board = useBattlefieldStore();

      const [first, second] = board.stacks as [BoardCardStack, BoardCardStack];
      const all = [
        first.primary,
        second.primary,
        ...first.attachments,
        ...second.unders,
      ];
      expect(new Set(all.map((c) => c.id)).size).toBe(4);
      expect(all.map((c) => c.id)).not.toContain(shared.scryfallInfo.id);
      expect(first.primary).not.toBe(second.primary);
      expect(first.primary.stack).toBe(first);
      expect(second.primary.stack).toBe(second);
      expect(second.primary.name).toBe('Twice');
    });

    it('keeps saved card IDs that are already unique', () => {
      const card = makeCard({ id: 'keep-me' });
      const stack: BoardCardStack = {
        id: 'stack-0',
        primary: card,
        attachments: new Set(),
        unders: new Set(),
        position: { x: 0, y: 0 },
      };
      card.stack = stack;
      localStorage.setItem(
        STORAGE_KEY,
        stringify({ stacks: [stack], zOrder: ['stack-0'] }),
      );

      const board = useBattlefieldStore();

      expect(board.stacks[0]!.primary.id).toBe('keep-me');
    });

    it('starts empty when nothing is saved', () => {
      const board = useBattlefieldStore();

      expect(board.load()).toBe(false);
      expect(board.stacks).toEqual([]);
    });

    // #25: each save() builds a new debounced function, so nothing is
    // debounced and every change writes the whole board.
    it.fails('writes once for a burst of changes (#25)', async () => {
      vi.useFakeTimers();
      const setItem = stubStorage();
      const board = useBattlefieldStore();

      for (let i = 1; i <= 3; i++) {
        board.setCenter({ x: i, y: i });
        await nextTick();
        vi.advanceTimersByTime(50);
      }
      vi.runAllTimers();

      const writes = setItem.mock.calls.filter(([key]) => key === STORAGE_KEY);
      expect(writes).toHaveLength(1);
    });
  });
});
