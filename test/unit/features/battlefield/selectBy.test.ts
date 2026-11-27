import { describe, expect, it } from 'vitest';
import {
  typeLineMatches,
  useBattlefieldStore,
  useSelectByType,
  useSelectionStore,
} from '~/features/battlefield';
import { cardData } from '~/features/battlefield/boardCard';
import type { ScryfallCard } from '~/types/Scryfall';
import { putOnBoard } from '../../fixtures/board';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

const goblin = { name: 'Goblin', type_line: 'Token Creature — Goblin' };
const soldier = { name: 'Soldier', type_line: 'Token Creature — Soldier' };
const forest = { name: 'Forest', type_line: 'Basic Land — Forest' };

/** Puts a card with this name and type line on the board. */
function place(info: Partial<ScryfallCard>, tapped = false) {
  const battlefield = useBattlefieldStore();
  return putOnBoard(
    battlefield,
    makeCard({ scryfallInfo: cardData(makeScryfallCard(info)), tapped }),
  );
}

describe('typeLineMatches (#220)', () => {
  it.each([
    ['goblin', true],
    ['CREATURE', true],
    ['token goblin', true],
    ['elf', false],
    // The name and text don't count.
    ['skirk', false],
    ['', false],
  ])('"%s" → %s', (query, expected) => {
    const card = makeScryfallCard({
      name: 'Skirk Goblin',
      type_line: 'Token Creature — Goblin',
      oracle_text: 'Haste',
    });
    expect(typeLineMatches(card, query)).toBe(expected);
  });

  it('matches the type line of any face', () => {
    const card = makeScryfallCard({
      name: 'Delver of Secrets // Insectile Aberration',
      card_faces: [
        { name: 'Delver of Secrets', type_line: 'Creature — Human Wizard' },
        { name: 'Insectile Aberration', type_line: 'Creature — Insect' },
      ],
    } as never);
    expect(typeLineMatches(card, 'insect')).toBe(true);
  });
});

describe('selection commands (#220)', () => {
  it('selects every stack', () => {
    place(goblin);
    place(forest);
    const selection = useSelectionStore();
    selection.selectAll();
    expect(selection.size).toBe(2);
  });

  it('inverts the selection', () => {
    const a = place(goblin);
    const b = place(soldier);
    const c = place(forest);
    const selection = useSelectionStore();
    selection.selectOnly(a.id);
    selection.invert();
    expect(selection.ids()).toEqual([b.id, c.id]);
  });

  it('selects tapped or untapped stacks', () => {
    const tapped = place(goblin, true);
    const untapped = place(soldier);
    const selection = useSelectionStore();
    selection.selectTapped(true);
    expect(selection.ids()).toEqual([tapped.id]);
    selection.selectTapped(false);
    expect(selection.ids()).toEqual([untapped.id]);
  });

  it('selects every stack named like a selected one', () => {
    const g1 = place(goblin);
    place(soldier);
    const g2 = place(goblin);
    const f = place(forest);
    const selection = useSelectionStore();
    selection.selectOnly(g1.id);
    selection.toggle(f.id);
    selection.selectSameName();
    expect(selection.size).toBe(3);
    expect(selection.has(g2.id)).toBe(true);
  });
});

describe('useSelectByType (#220)', () => {
  it('selects the matching stacks as the query changes', () => {
    const g1 = place(goblin);
    place(forest);
    const g2 = place(goblin);
    const select = useSelectByType();
    const selection = useSelectionStore();

    select.open();
    select.setQuery('goblin');
    expect(select.matches.map((s) => s.id)).toEqual([g1.id, g2.id]);
    expect(selection.ids()).toEqual([g1.id, g2.id]);

    select.setQuery('creature');
    expect(selection.size).toBe(2);
    select.setQuery('land');
    expect(selection.size).toBe(1);
  });

  it('keeps the selection when done', () => {
    place(goblin);
    place(forest);
    const select = useSelectByType();
    select.open();
    select.setQuery('land');
    select.done();
    expect(select.isOpen).toBe(false);
    expect(useSelectionStore().size).toBe(1);
  });

  it('puts the selection back when cancelled', () => {
    const g = place(goblin);
    place(forest);
    const selection = useSelectionStore();
    selection.selectOnly(g.id);
    const select = useSelectByType();
    select.open();
    select.setQuery('land');
    select.cancel();
    expect(select.isOpen).toBe(false);
    expect(selection.ids()).toEqual([g.id]);
  });
});
