/** The kinds of Scryfall object Add card can search (#217). */
export type SearchCategory = 'regular' | 'tokens' | 'extras';

export const SEARCH_CATEGORIES: readonly {
  value: SearchCategory;
  label: string;
}[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'extras', label: 'Extras' },
];

/**
 * Each category's clause, spelled out rather than left to Scryfall's
 * defaults. A card matches exactly one. Extras leaves out memorabilia (art
 * cards and the like) and `t:card` (minigame and insert cards), which aren't
 * game pieces.
 */
const CLAUSES: Record<SearchCategory, string> = {
  regular: 'not:extras',
  tokens: 't:token',
  extras: '(is:extras -t:token -set_type:memorabilia -t:card)',
};

/**
 * The Scryfall query for `term` limited to `categories`, or '' when there's
 * nothing to search. The term is wrapped so an `or` in it stays inside it.
 * `include:extras` goes outside every parenthesis: Scryfall rejects display
 * options inside them.
 */
export function buildSearchQuery(
  term: string,
  categories: readonly SearchCategory[],
): string {
  const q = term.trim();
  const picked = SEARCH_CATEGORIES.map((c) => c.value).filter((c) =>
    categories.includes(c),
  );
  if (!q || !picked.length) return '';

  const clauses = picked.map((c) => CLAUSES[c]);
  const filter =
    clauses.length === 1 ? clauses[0] : `(${clauses.join(' or ')})`;
  const include = picked.some((c) => c !== 'regular') ? 'include:extras ' : '';
  return `(${q}) ${include}${filter}`;
}
