import { describe, expect, it } from 'vitest';
import {
  arrangeInRows,
  arrangeRow,
  rowBand,
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

  it('arranges stacks into rows inside the view', () => {
    const battlefield = board();
    const land = putOnBoard(battlefield, card('Land'), { x: 900, y: 50 });
    const bear = putOnBoard(battlefield, card('Creature — Bear'), {
      x: 1500,
      y: 1200,
    });

    battlefield.arrangeStacks([land, bear]);
    const [l, b] = [land, bear].map(
      (s) => battlefield.stacks.find((x) => x.id === s.id)!.position,
    );
    expect(b!.y).toBeLessThan(l!.y);
    expect(b!.x).toBeGreaterThanOrEqual(0);
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
