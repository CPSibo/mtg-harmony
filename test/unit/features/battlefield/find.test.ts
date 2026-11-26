import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import {
  cardMatches,
  createBoardCard,
  useBattlefieldStore,
  useBoardFind,
  useSelectionStore,
} from '~/features/battlefield';
import { putOnBoard } from '../../fixtures/board';
import { makeScryfallCard } from '../../fixtures/cards';

const goblin = makeScryfallCard({
  name: 'Goblin Guide',
  type_line: 'Creature — Goblin Scout',
  oracle_text: 'Haste',
});
const dfc = makeScryfallCard({
  name: 'Delver of Secrets // Insectile Aberration',
  card_faces: [
    {
      name: 'Delver of Secrets',
      type_line: 'Creature — Human Wizard',
      oracle_text: 'Look at the top card',
    },
    {
      name: 'Insectile Aberration',
      type_line: 'Creature — Human Insect',
      oracle_text: 'Flying',
    },
  ],
} as never);

describe('cardMatches (#219)', () => {
  it.each([
    ['goblin', true],
    ['GUIDE', true],
    ['scout', true],
    ['haste', true],
    ['goblin haste', true],
    ['goblin flying', false],
    ['elf', false],
  ])('%s → %s on name, type line and text', (query, expected) => {
    expect(cardMatches(goblin, query)).toBe(expected);
  });

  it('matches any face', () => {
    expect(cardMatches(dfc, 'flying')).toBe(true);
    expect(cardMatches(dfc, 'insect')).toBe(true);
  });

  it('matches nothing for a blank query', () => {
    expect(cardMatches(goblin, '  ')).toBe(false);
  });
});

function board() {
  const battlefield = useBattlefieldStore();
  const add = (card = makeScryfallCard(), x = 0, y = 0) =>
    putOnBoard(battlefield, createBoardCard(card), { x, y });
  return { battlefield, add };
}

describe('useBoardFind (#219)', () => {
  it('finds stacks top to bottom, then left to right', async () => {
    const { add } = board();
    const right = add(makeScryfallCard({ name: 'Goblin A' }), 900, 100);
    const low = add(makeScryfallCard({ name: 'Goblin B' }), 0, 900);
    add(makeScryfallCard({ name: 'Elf' }), 0, 0);
    const left = add(makeScryfallCard({ name: 'Goblin C' }), 100, 100);

    const find = useBoardFind();
    find.setQuery('goblin');
    await nextTick();
    expect(find.matches.map((s) => s.id)).toEqual([left.id, right.id, low.id]);
    expect(find.current?.id).toBe(left.id);
  });

  it('matches a stack by its attachments and unders too', () => {
    const { battlefield, add } = board();
    const host = add(makeScryfallCard({ name: 'Bear' }));
    const aura = createBoardCard(makeScryfallCard({ name: 'Pacifism' }));
    battlefield.stacks.at(-1)!.attachments.add(aura);

    const find = useBoardFind();
    find.setQuery('pacifism');
    expect(find.matches.map((s) => s.id)).toEqual([host.id]);
  });

  it('steps through the matches, wrapping both ways', () => {
    const { add } = board();
    const a = add(makeScryfallCard({ name: 'Goblin A' }), 0, 0);
    const b = add(makeScryfallCard({ name: 'Goblin B' }), 500, 0);

    const find = useBoardFind();
    find.setQuery('goblin');
    find.next();
    expect(find.current?.id).toBe(b.id);
    find.next();
    expect(find.current?.id).toBe(a.id);
    find.previous();
    expect(find.current?.id).toBe(b.id);
    expect(find.position).toBe(2);
  });

  it('starts from the first match when the query changes', () => {
    const { add } = board();
    const a = add(makeScryfallCard({ name: 'Goblin A' }), 0, 0);
    add(makeScryfallCard({ name: 'Goblin B' }), 500, 0);

    const find = useBoardFind();
    find.setQuery('gob');
    find.next();
    find.setQuery('goblin');
    expect(find.current?.id).toBe(a.id);
  });

  it('has no current match when nothing matches', () => {
    board().add(makeScryfallCard({ name: 'Elf' }));
    const find = useBoardFind();
    find.setQuery('goblin');
    expect(find.current).toBeNull();
    expect(find.position).toBe(0);
    find.next();
    expect(find.current).toBeNull();
  });

  it('selects the current match', async () => {
    const { add } = board();
    const a = add(makeScryfallCard({ name: 'Goblin A' }), 0, 0);
    const b = add(makeScryfallCard({ name: 'Goblin B' }), 500, 0);
    const selection = useSelectionStore();

    const find = useBoardFind();
    find.open();
    find.setQuery('goblin');
    await nextTick();
    expect(selection.ids()).toEqual([a.id]);
    find.next();
    await nextTick();
    expect(selection.ids()).toEqual([b.id]);
  });

  it('clears the query when closed', () => {
    const find = useBoardFind();
    find.open();
    find.setQuery('goblin');
    find.close();
    expect(find.isOpen).toBe(false);
    expect(find.query).toBe('');
  });
});
