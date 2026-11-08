import { stringify } from 'devalue';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useBattlefieldStore } from '~/features/battlefield';
import { useEventLogStore, type EventEntry } from '~/features/eventLog';
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

      expect(board.isValidAttachmentTarget(other!.primary)).toBe(false); // Not attaching.

      board.startAttaching(equipment!.primary);
      expect(board.isValidAttachmentTarget(other!.primary)).toBe(true);
      expect(board.isValidAttachmentTarget(host!.primary)).toBe(true);
      expect(board.isValidAttachmentTarget(equipment!.primary)).toBe(false); // Itself.
      expect(board.isValidAttachmentTarget(aura)).toBe(false); // Not a primary.
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

    // #26: the unders row used to be centred using the attachment count.
    it('centres the unders row on the stack', () => {
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
      board.setSnapScale(25);
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

    it('starts empty when nothing is saved', () => {
      const board = useBattlefieldStore();

      expect(board.load()).toBe(false);
      expect(board.stacks).toEqual([]);
    });

    // #25: each save() built a new debounced function, so nothing was
    // debounced and every change wrote the whole board.
    it('writes once for a burst of changes', async () => {
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

// #33
describe('copying cards', () => {
  const flying = { name: 'Flying', symbol: 'ms ms-ability-flying' };

  /** A tapped Host with a +1 counter, face number 3, an attachment and an under. */
  function decoratedHost() {
    const board = boardWithAttachments(1);
    const host = board.stacks[0]!;
    host.position = { x: 500, y: 600 };
    host.primary.tapped = true;
    host.primary.faceNumber = 3;
    host.primary.modifiers.add({ modifier: flying, count: 2 });
    const under = makeCard({ name: 'Under 0', tapped: true });
    host.unders.add(under);
    under.stack = host;
    return { board, host };
  }

  it('copies just the card with fresh state', () => {
    const { board, host } = decoratedHost();

    const copy = board.copyCard(host.primary, 'card');

    expect(copy.primary.id).not.toBe(host.primary.id);
    expect(copy.primary.scryfallInfo).toBe(host.primary.scryfallInfo);
    expect(copy.primary).toMatchObject({
      name: 'Host',
      tapped: false,
      faceNumber: 0,
      stack: copy,
    });
    expect(copy.primary.modifiers.size).toBe(0);
    expect(copy.attachments.size).toBe(0);
    expect(copy.unders.size).toBe(0);
  });

  it('copies the card with its own counters, face number and tapped state', () => {
    const { board, host } = decoratedHost();

    const copy = board.copyCard(host.primary, 'counters');

    expect(copy.primary).toMatchObject({ tapped: true, faceNumber: 3 });
    expect([...copy.primary.modifiers]).toEqual([
      { modifier: flying, count: 2 },
    ]);
    expect(copy.attachments.size).toBe(0);

    // The copy's counters are its own.
    [...copy.primary.modifiers][0]!.count = 9;
    expect([...host.primary.modifiers][0]!.count).toBe(2);
  });

  it('copies an attached card on its own', () => {
    const { board, host } = decoratedHost();
    const aura = [...host.attachments][0]!;

    const copy = board.copyCard(aura, 'card');

    expect(copy.primary.name).toBe('Aura 0');
    expect(host.attachments.size).toBe(1);
  });

  it('copies everything: the whole stack, each card with its state and a new ID', () => {
    const { board, host } = decoratedHost();

    const copy = board.copyCard(host.primary, 'stack');

    expect(copy.primary).toMatchObject({ name: 'Host', tapped: true });
    expect([...copy.attachments].map((c) => c.name)).toEqual(['Aura 0']);
    expect([...copy.unders]).toMatchObject([{ name: 'Under 0', tapped: true }]);
    const all = [copy.primary, ...copy.attachments, ...copy.unders];
    const originals = [host.primary, ...host.attachments, ...host.unders];
    for (const card of all) {
      expect(card.stack).toBe(copy);
      expect(originals.map((c) => c.id)).not.toContain(card.id);
    }
  });

  it('copies everything from an attachment as its whole stack', () => {
    const { board, host } = decoratedHost();

    const copy = board.copyCard([...host.attachments][0]!, 'stack');

    expect(copy.primary.name).toBe('Host');
    expect(copy.attachments.size).toBe(1);
  });

  it('places the copy offset from the source, in front', () => {
    const { board, host } = decoratedHost();

    const copy = board.copyCard(host.primary, 'card');

    expect(copy.position).not.toEqual(host.position);
    expect(Math.abs(copy.position.x - host.position.x)).toBeLessThan(100);
    expect(Math.abs(copy.position.y - host.position.y)).toBeLessThan(100);
    expect(board.orderedStacks.at(-1)).toBe(copy);
    expect(board.stacks).toHaveLength(2);
  });
});

// #34
describe('unders', () => {
  it('puts a board card under another stack', () => {
    const board = useBattlefieldStore();
    const host = board.addStackByCard(makeCard({ name: 'Host' }));
    const exiled = makeCard({ name: 'Exiled' });
    board.addStackByCard(exiled);

    board.startAttaching(exiled, 'under');
    expect(board.attachMode).toBe('under');
    board.finishAttaching(board.stacks[0]!);

    expect(names(board.stacks)).toEqual(['Host']);
    expect([...board.stacks[0]!.unders].map((c) => c.name)).toEqual(['Exiled']);
    expect(board.stacks[0]!.attachments.size).toBe(0);
    expect(exiled.stack).toStrictEqual(host);
    expect(board.isAttaching).toBe(false);
  });

  it('attaches by default', () => {
    const board = boardWithAttachments(1);

    expect(board.stacks[0]!.attachments.size).toBe(1);
    expect(board.stacks[0]!.unders.size).toBe(0);
  });

  it('can move an attachment under its own stack', () => {
    const board = boardWithAttachments(1);
    const aura = [...board.stacks[0]!.attachments][0]!;

    board.startAttaching(aura, 'under');
    expect(board.isValidAttachmentTarget(board.stacks[0]!.primary)).toBe(true);
    board.finishAttaching(board.stacks[0]!);

    expect(board.stacks[0]!.attachments.size).toBe(0);
    expect(board.stacks[0]!.unders.size).toBe(1);
  });

  it('does not put a card under a stack it is already under', () => {
    const board = boardWithUnders(1);
    const under = [...board.stacks[0]!.unders][0]!;

    board.startAttaching(under, 'under');

    expect(board.isValidAttachmentTarget(board.stacks[0]!.primary)).toBe(false);
  });

  it('takes an under out to its own stack below the host', () => {
    const board = boardWithUnders(2);
    const host = board.stacks[0]!;
    host.position = { x: 300, y: 300 };
    const under = [...host.unders][0]!;

    board.detach(under);

    expect(host.unders.size).toBe(1);
    expect(names(board.stacks)).toEqual(['Host', 'Under 0']);
    expect(under.stack).toStrictEqual(board.stacks[1]);
    expect(board.stacks[1]!.position.y).toBeGreaterThan(300);
  });

  it('removes an under from the board', () => {
    const board = boardWithUnders(1);
    const under = [...board.stacks[0]!.unders][0]!;

    board.removeCardFromStack(under);

    expect(board.stacks[0]!.unders.size).toBe(0);
    expect(board.stacks).toHaveLength(1);
  });
});

// #36
describe('event log', () => {
  /** Each entry as "type card [target|source]". */
  function logged() {
    return useEventLogStore().entries.map((e: EventEntry) =>
      [
        e.type,
        'card' in e ? e.card.name : '',
        'target' in e ? e.target.name : '',
        'source' in e ? e.source.name : '',
        'mode' in e ? e.mode : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  it('logs casting from On-deck and adding through Add Card', () => {
    const board = useBattlefieldStore();

    board.castCard(makeScryfallCard({ name: 'Cast' }));
    board.castCard(makeScryfallCard({ name: 'Added' }), 'added');

    expect(logged()).toEqual(['cast Cast', 'added Added']);
    const [entry] = useEventLogStore().entries;
    expect(entry && 'card' in entry && entry.card.instanceId).toBe(
      board.stacks[0]!.primary.id,
    );
  });

  it('logs attaching and putting under, with the target', () => {
    const board = useBattlefieldStore();
    const host = board.addStackByCard(makeCard({ name: 'Host' }));
    board.addStackByCard(makeCard({ name: 'Aura' }));
    board.addStackByCard(makeCard({ name: 'Exiled' }));

    board.startAttaching(board.stacks[1]!.primary);
    board.finishAttaching(host);
    board.startAttaching(board.stacks[1]!.primary, 'under');
    board.finishAttaching(board.stacks[0]!);

    expect(logged()).toEqual(['attached Aura Host', 'putUnder Exiled Host']);
  });

  it('logs a copy with its source and mode', () => {
    const board = useBattlefieldStore();
    const host = board.addStackByCard(makeCard({ name: 'Host' }));

    const copy = board.copyCard(host.primary, 'counters');

    expect(logged()).toEqual(['copied Host Host counters']);
    const [entry] = useEventLogStore().entries;
    expect(entry && 'card' in entry && entry.card.instanceId).toBe(
      copy.primary.id,
    );
  });

  it('logs removing a card, but not the moves it causes', () => {
    const board = boardWithAttachments(1);

    board.removeCard(board.stacks[0]!.primary);

    expect(logged()).toEqual(['attached Aura 0 Host', 'removed Host']);
    expect(names(board.stacks)).toEqual(['Aura 0']);
  });

  it('does not log moving, tapping, detaching or counters', () => {
    const board = boardWithAttachments(1);
    const host = board.stacks[0]!;
    useEventLogStore().reset();

    board.setStackPosition(host, { x: 1, y: 2 });
    board.toggleTapped(host.primary);
    board.setFaceNumber(host.primary, 3);
    board.clearModifiers(host.primary);
    board.detach([...host.attachments][0]!);

    expect(logged()).toEqual([]);
  });

  it('logs clearing the board', () => {
    const board = useBattlefieldStore();
    board.castCard(makeScryfallCard({ name: 'Gone' }));

    board.clearBoard();

    expect(logged()).toEqual(['cast Gone', 'boardCleared']);
    expect(board.stacks).toEqual([]);
  });
});

// #78
describe('casting into the view', () => {
  const view = { x: 1000, y: 1000, width: 1200, height: 800 };
  const size = { width: 200, height: 250 };

  function rectOf(
    board: ReturnType<typeof useBattlefieldStore>,
    stack: BoardCardStack,
  ) {
    return { ...stack.position, ...board.stackSize(stack) };
  }

  it('casts cards side by side in the view, none overlapping', () => {
    const board = useBattlefieldStore();
    board.setView(view);

    const stacks = Array.from({ length: 6 }, () =>
      board.castCard(makeScryfallCard()),
    );

    const rects = stacks.map((s) => rectOf(board, s));
    for (const [i, a] of rects.entries()) {
      const shownW =
        Math.min(a.x + a.width, view.x + view.width) - Math.max(a.x, view.x);
      const shownH =
        Math.min(a.y + a.height, view.y + view.height) - Math.max(a.y, view.y);
      expect(shownW * shownH).toBeGreaterThanOrEqual((a.width * a.height) / 3);
      for (const b of rects.slice(i + 1)) {
        expect(
          a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height,
        ).toBe(false);
      }
    }
  });

  it('uses the measured size of stacks on the board', () => {
    const board = useBattlefieldStore();
    board.setView(view);
    const first = board.castCard(makeScryfallCard());
    board.setStackSize(first.id, { width: 1200, height: 400 });
    board.setStackPosition(first, { x: view.x, y: view.y });

    const second = board.castCard(makeScryfallCard());

    expect(second.position.y).toBeGreaterThanOrEqual(view.y + 400);
  });

  it('with the view full, cards land offset from each other', () => {
    const board = useBattlefieldStore();
    board.setView(view);
    const filler = board.castCard(makeScryfallCard());
    board.setStackSize(filler.id, {
      width: view.width * 2,
      height: view.height * 2,
    });
    board.setStackPosition(filler, {
      x: view.x - view.width / 2,
      y: view.y - view.height / 2,
    });

    const a = board.castCard(makeScryfallCard());
    const b = board.castCard(makeScryfallCard());

    expect(b.position).not.toEqual(a.position);
    for (const s of [a, b]) {
      expect(s.position.x).toBeGreaterThan(view.x - size.width);
      expect(s.position.x).toBeLessThan(view.x + view.width);
    }
  });

  it('falls back to the saved centre before the board reports a view', () => {
    const board = useBattlefieldStore();
    board.setCenter({ x: 42, y: 24 });

    expect(board.castCard(makeScryfallCard()).position).toEqual({
      x: 42,
      y: 24,
    });
  });
});

// #79
describe('casting at a drop point', () => {
  it('centres the card on the given board point', () => {
    const board = useBattlefieldStore();

    const stack = board.castCard(makeScryfallCard(), 'cast', {
      x: 1000,
      y: 800,
    });

    const size = board.stackSize(stack);
    // The card sits right of the action buttons column.
    const cardLeft = stack.position.x + board.stackActionsWidth;
    const cardWidth = size.width - board.stackActionsWidth;
    expect(cardLeft + cardWidth / 2).toBe(1000);
    expect(stack.position.y + size.height / 2).toBe(800);
  });

  it('turns a screen point into a board point with the pan and zoom', () => {
    const board = useBattlefieldStore();
    board.setTransform({ x: -2000, y: -1500, scale: 2 });

    expect(board.boardPointFromScreen({ x: 100, y: 50 })).toEqual({
      x: 1050,
      y: 775,
    });
  });

  it('has no board point before the board reports its transform', () => {
    expect(
      useBattlefieldStore().boardPointFromScreen({ x: 1, y: 1 }),
    ).toBeNull();
  });
});
