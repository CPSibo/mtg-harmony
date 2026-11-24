const SCRYFALL_PAGE = 'https://scryfall.com/';

/**
 * `url` if it's a page on scryfall.com, else undefined. Card links come from
 * Scryfall's data and from saved storage, so they're checked before they
 * become an `href`: tampered storage or odd data can't make a `javascript:`
 * or off-site link (#157).
 */
export function scryfallLink(url: string | undefined): string | undefined {
  return url?.startsWith(SCRYFALL_PAGE) ? url : undefined;
}
