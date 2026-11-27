import { describe, expect, it } from 'vitest';
import {
  arrangeInRows,
  arrangeToFit,
  arrangeRow,
  BOARD_SIZE,
  rowBand,
  stackReach,
  createBoardCard,
  useBattlefieldStore,
  type Rect,
} from '~/features/battlefield';
import { useSettingsStore } from '~/stores/settings';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard } from '../../fixtures/cards';

const card = (type_line: string, extra = {}) =>
  createBoardCard(makeScryfallCard({ type_line, ...extra }));

describe('arrangeRow (#223)', () => {
  it.each([
    ['Creature — Goblin', 'creatures'],
    ['Artifact Creature — Golem', 'creatures'],
    ['Land Creature — Forest Dryad', 'creatures'],
    ['Basic Land — Forest', 'lands'],
    ['Artifact Land', 'lands'],
    ['Enchantment — Aura', 'other'],
    ['Legendary Planeswalker — Jace', 'other'],
    ['Battle — Siege', 'other'],
  ])('%s goes in %s', (type, row) => {
    expect(arrangeRow(card(type))).toBe(row);
  });

  it('goes by the face showing', () => {
    const dfc = createBoardCard(
      makeScryfallCard({
        layout: 'transform',
        card_faces: [
          {
            name: 'Front',
            type_line: 'Creature — Human',
            image_uris: { border_crop: 'https://img.example/f.jpg' },
          },
          {
            name: 'Back',
            type_line: 'Land',
            image_uris: { border_crop: 'https://img.example/b.jpg' },
          },
        ],
      } as never),
    );
    expect(arrangeRow(dfc)).toBe('creatures');
    dfc.flipped = true;
    expect(arrangeRow(dfc)).toBe('lands');
  });
});

describe('arrangeInRows (#223)', () => {
  const size = { width: 100, height: 140 };
  const item = (
    id: string,
    row: 'creatures' | 'other' | 'lands',
    x = 0,
    y = 0,
  ) => ({
    id,
    row,
    size,
    position: { x, y },
  });

  it('puts creatures, then other cards, then lands, in rows', () => {
    const at = arrangeInRows(
      [item('land', 'lands'), item('aura', 'other'), item('bear', 'creatures')],
      { x: 0, y: 0, width: 1000 },
      10,
    );
    expect(at.get('bear')).toEqual({ x: 0, y: 0 });
    expect(at.get('aura')!.y).toBeGreaterThan(140);
    expect(at.get('land')!.y).toBeGreaterThan(at.get('aura')!.y + 140);
  });

  it('keeps cards in their left-to-right order within a row', () => {
    const at = arrangeInRows(
      [item('b', 'creatures', 500), item('a', 'creatures', 100)],
      { x: 0, y: 0, width: 1000 },
      10,
    );
    expect(at.get('a')).toEqual({ x: 0, y: 0 });
    expect(at.get('b')).toEqual({ x: 110, y: 0 });
  });

  it('reads the cards line by line, so arranging again changes nothing', () => {
    // Two lines already laid out: a b / c, with c left of b.
    const items = [
      item('a', 'creatures', 0, 0),
      item('b', 'creatures', 110, 0),
      item('c', 'creatures', 0, 150),
    ];
    const at = arrangeInRows(items, { x: 0, y: 0, width: 230 }, 10);
    expect(at.get('a')).toEqual({ x: 0, y: 0 });
    expect(at.get('b')).toEqual({ x: 110, y: 0 });
    expect(at.get('c')).toEqual({ x: 0, y: 150 });
  });

  it('wraps a row at the width', () => {
    const at = arrangeInRows(
      ['a', 'b', 'c'].map((id, i) => item(id, 'creatures', i)),
      { x: 50, y: 20, width: 230 },
      10,
    );
    expect(at.get('a')).toEqual({ x: 50, y: 20 });
    expect(at.get('b')).toEqual({ x: 160, y: 20 });
    expect(at.get('c')).toEqual({ x: 50, y: 170 });
  });

  it('leaves room for what a stack reaches past its box (#237)', () => {
    const at = arrangeInRows(
      [
        { ...item('a', 'creatures', 0), reach: { left: 20, right: 30 } },
        item('b', 'creatures', 1),
      ],
      { x: 0, y: 0, width: 1000 },
      10,
    );
    expect(at.get('a')).toEqual({ x: 20, y: 0 });
    expect(at.get('b')).toEqual({ x: 20 + 100 + 30 + 10, y: 0 });
  });

  it('wraps by what a stack reaches, too (#237)', () => {
    const at = arrangeInRows(
      [
        item('a', 'creatures', 0),
        { ...item('b', 'creatures', 1), reach: { left: 0, right: 30 } },
      ],
      { x: 0, y: 0, width: 230 },
      10,
    );
    expect(at.get('b')).toEqual({ x: 0, y: 150 });
  });

  it('leaves no gap for an empty row', () => {
    const at = arrangeInRows(
      [item('bear', 'creatures'), item('land', 'lands')],
      { x: 0, y: 0, width: 1000 },
      10,
    );
    const withOther = arrangeInRows(
      [item('bear', 'creatures'), item('aura', 'other'), item('land', 'lands')],
      { x: 0, y: 0, width: 1000 },
      10,
    );
    expect(at.get('land')!.y).toBeLessThan(withOther.get('land')!.y);
  });
});

describe('stackReach (#237)', () => {
  const board = () => useBattlefieldStore();

  it('reaches nowhere for an upright card without badges', () => {
    const stack = putOnBoard(board(), card('Creature — Bear'));
    expect(stackReach(stack)).toEqual({ left: 0, right: 0 });
  });

  it('reaches both sides for a tapped card', () => {
    const stack = putOnBoard(board(), card('Creature — Bear'));
    stack.primary.tapped = true;
    const reach = stackReach(stack);
    expect(reach.left).toBeGreaterThan(0);
    expect(reach.right).toBe(reach.left);
  });

  it('reaches right for each column of badges', () => {
    const stack = putOnBoard(board(), card('Creature — Bear'));
    stack.primary.modifiers.set('flying', 1);
    const one = stackReach(stack).right;
    expect(one).toBeGreaterThan(0);

    for (const key of ['trample', 'haste', 'reach', 'menace'] as const)
      stack.primary.modifiers.set(key, 1);
    expect(stackReach(stack).right).toBe(one);

    stack.primary.modifiers.set('vigilance', 1);
    expect(stackReach(stack).right).toBeGreaterThan(one);
  });

  it('counts an attachment’s badges, three to a column', () => {
    const stack = putOnBoard(board(), card('Creature — Bear'));
    const aura = card('Enchantment — Aura');
    for (const key of ['flying', 'trample', 'haste', 'reach'] as const)
      aura.modifiers.set(key, 1);
    stack.attachments.add(aura);
    const two = stackReach(stack).right;

    aura.modifiers.delete('reach');
    expect(stackReach(stack).right).toBeLessThan(two);
  });
});

describe('arrangeToFit', () => {
  const size = { width: 100, height: 100 };
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      row: 'creatures' as const,
      size,
      position: { x: i, y: 0 },
    }));
  const bounds = (at: Map<string, { x: number; y: number }>) => {
    const ps = [...at.values()];
    const left = Math.min(...ps.map((p) => p.x));
    const top = Math.min(...ps.map((p) => p.y));
    return {
      left,
      top,
      width: Math.max(...ps.map((p) => p.x)) + size.width - left,
      height: Math.max(...ps.map((p) => p.y)) + size.height - top,
    };
  };

  it('shapes the layout like the view: a square view gets a square grid', () => {
    const b = bounds(arrangeToFit(items(9), { x: 0, y: 0 }, 1, 0));
    expect(b.width).toBe(300);
    expect(b.height).toBe(300);
  });

  it('lays a few cards in one line in a wide view', () => {
    const b = bounds(arrangeToFit(items(3), { x: 0, y: 0 }, 16 / 9, 0));
    expect(b.height).toBe(100);
  });

  it('centres the layout on the given point', () => {
    const b = bounds(arrangeToFit(items(9), { x: 2500, y: 2500 }, 1, 0));
    expect(b.left + b.width / 2).toBe(2500);
    expect(b.top + b.height / 2).toBe(2500);
  });
});

describe('rowBand (#223)', () => {
  const view: Rect = { x: 100, y: 200, width: 900, height: 900 };

  it('splits a tall view into thirds: creatures top, lands bottom', () => {
    expect(rowBand('creatures', view, 250)).toEqual({
      x: 100,
      y: 200,
      width: 900,
      height: 300,
    });
    expect(rowBand('other', view, 250)).toEqual({
      x: 100,
      y: 500,
      width: 900,
      height: 300,
    });
    expect(rowBand('lands', view, 250)).toEqual({
      x: 100,
      y: 800,
      width: 900,
      height: 300,
    });
  });

  it('keeps each band a card tall in a short view, top and bottom in view', () => {
    const short = { ...view, height: 450 };
    const top = rowBand('creatures', short, 250);
    const bottom = rowBand('lands', short, 250);
    expect(top.height).toBe(250);
    expect(top.y).toBe(200);
    expect(bottom.y + bottom.height).toBe(650);
  });
});

describe('battlefield arranging (#223)', () => {
  function board() {
    const battlefield = useBattlefieldStore();
    battlefield.setView({ x: 0, y: 0, width: 2000, height: 1500 });
    return battlefield;
  }

  it('arranges every stack into rows, creatures first', () => {
    const battlefield = board();
    const land = putOnBoard(battlefield, card('Land'), { x: 900, y: 50 });
    const bear = putOnBoard(battlefield, card('Creature — Bear'), {
      x: 1500,
      y: 1200,
    });

    battlefield.arrangeStacks();
    const [l, b] = [land, bear].map(
      (s) => battlefield.stacks.find((x) => x.id === s.id)!.position,
    );
    expect(b!.y).toBeLessThan(l!.y);
  });

  it('lands the same wherever the view is and however zoomed', () => {
    const battlefield = board();
    for (let i = 0; i < 6; i++)
      putOnBoard(battlefield, card('Creature — Bear'), { x: i * 300, y: 0 });
    const positions = () => battlefield.stacks.map((s) => ({ ...s.position }));

    battlefield.arrangeStacks();
    const first = positions();
    // Panned to a corner and zoomed in, same shape.
    battlefield.setView({ x: 4000, y: 4000, width: 400, height: 300 });
    battlefield.arrangeStacks();
    expect(positions()).toEqual(first);
    // And around the middle of the board.
    const xs = first.map((p) => p.x);
    const mid = (Math.min(...xs) + Math.max(...xs) + 210) / 2;
    expect(Math.abs(mid - BOARD_SIZE.width / 2)).toBeLessThan(50);
  });

  it('puts a new card in its row when arranging new cards is on', () => {
    const battlefield = board();
    useSettingsStore().arrangeNewCards = true;

    const land = battlefield.castCard(
      makeScryfallCard({ type_line: 'Basic Land — Island' }),
    );
    const bear = battlefield.castCard(
      makeScryfallCard({ type_line: 'Creature — Bear' }),
    );
    expect(bear.position.y).toBeLessThan(500);
    expect(land.position.y).toBeGreaterThan(1000);
  });

  it('puts a new card in the middle of the view when it is off', () => {
    const battlefield = board();
    const land = battlefield.castCard(
      makeScryfallCard({ type_line: 'Basic Land — Island' }),
    );
    expect(land.position.y).toBeLessThan(1000);
    expect(land.position.y).toBeGreaterThan(400);
  });
});
