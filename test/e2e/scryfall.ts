/**
 * The player's text from an Add card search URL. Add card sends
 * `(<text>) <filters>` (#217); mocks match on the text alone.
 */
export function searchText(url: URL): string {
  const q = url.searchParams.get('q')?.trim() ?? '';
  const wrapped = /^\((.*)\)\s/.exec(q);
  return (wrapped ? wrapped[1]! : q).trim().toLowerCase();
}
