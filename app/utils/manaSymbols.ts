/** One part of a mana cost: a mana-font symbol, or text such as `//`. */
export type ManaPart = { symbol: string; label: string } | { text: string };

/**
 * A Scryfall mana cost (`{2}{W/U}`) as mana-font classes, one per symbol.
 * Hybrid and Phyrexian symbols drop the slash (`{W/U}` → `ms-wu`). A split
 * card's `//` stays as text.
 */
export function manaSymbols(cost: string | undefined): ManaPart[] {
  if (!cost) return [];
  const parts: ManaPart[] = [];
  for (const match of cost.matchAll(/\{([^}]+)\}|\/\//g)) {
    const label = match[1];
    if (label === undefined) {
      parts.push({ text: '//' });
      continue;
    }
    const name = label.toLowerCase().replaceAll('/', '');
    parts.push({ symbol: `ms ms-${name} ms-cost`, label });
  }
  return parts;
}
