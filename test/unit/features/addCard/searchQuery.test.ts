import { describe, expect, it } from 'vitest';
import {
  buildSearchQuery,
  type SearchCategory,
} from '~/features/addCard/searchQuery';

const EXTRAS = '(is:extras -t:token -set_type:memorabilia -t:card)';

describe('buildSearchQuery', () => {
  it('excludes extras explicitly for regular cards', () => {
    expect(buildSearchQuery('sol ring', ['regular'])).toBe(
      '(sol ring) not:extras',
    );
  });

  it('includes extras for tokens, outside any parentheses', () => {
    // Scryfall rejects display options like include:extras in parentheses.
    expect(buildSearchQuery('goblin', ['tokens'])).toBe(
      '(goblin) include:extras t:token',
    );
  });

  it('keeps art cards and inserts out of extras', () => {
    expect(buildSearchQuery('goblin', ['extras'])).toBe(
      `(goblin) include:extras ${EXTRAS}`,
    );
  });

  it.each<[SearchCategory[], string]>([
    [['regular', 'tokens'], '(goblin) include:extras (not:extras or t:token)'],
    [
      ['regular', 'extras'],
      `(goblin) include:extras (not:extras or ${EXTRAS})`,
    ],
    [['tokens', 'extras'], `(goblin) include:extras (t:token or ${EXTRAS})`],
    [
      ['regular', 'tokens', 'extras'],
      `(goblin) include:extras (not:extras or t:token or ${EXTRAS})`,
    ],
  ])('combines %j with or', (categories, expected) => {
    expect(buildSearchQuery('goblin', categories)).toBe(expected);
  });

  it('orders the clauses the same whatever order they are picked in', () => {
    expect(buildSearchQuery('goblin', ['tokens', 'regular'])).toBe(
      buildSearchQuery('goblin', ['regular', 'tokens']),
    );
  });

  it('wraps the term so its own or stays inside it', () => {
    expect(buildSearchQuery('goblin or elf', ['regular'])).toBe(
      '(goblin or elf) not:extras',
    );
  });

  it('trims the term', () => {
    expect(buildSearchQuery('  sol ring ', ['regular'])).toBe(
      '(sol ring) not:extras',
    );
  });

  it('builds nothing for a blank term', () => {
    expect(buildSearchQuery('   ', ['regular'])).toBe('');
  });

  it('builds nothing with no category picked', () => {
    expect(buildSearchQuery('goblin', [])).toBe('');
  });
});
