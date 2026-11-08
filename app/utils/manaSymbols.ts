/** One part of a mana cost or rules text: a mana-font symbol, or text. */
export type ManaPart = { symbol: string; label: string } | { text: string };

/** Scryfall symbols whose mana-font class isn't just the letters. */
const SYMBOL_NAMES: Record<string, string> = { t: 'tap', q: 'untap' };

/**
 * Text with Scryfall symbols (`{T}: Add {G}.`) as parts: mana-font classes for
 * each symbol, and the text between. Hybrid and Phyrexian symbols drop the
 * slash (`{W/U}` → `ms-wu`).
 */
export function symbolize(text: string | undefined): ManaPart[] {
  if (!text) return [];
  const parts: ManaPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\{([^}]+)\}/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    const label = match[1]!;
    const letters = label.toLowerCase().replaceAll('/', '');
    const name = SYMBOL_NAMES[letters] ?? letters;
    parts.push({ symbol: `ms ms-${name} ms-cost`, label });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/**
 * A Scryfall mana cost (`{2}{W/U}`) as mana-font classes, one per symbol. A
 * split card's `//` stays as text.
 */
export function manaSymbols(cost: string | undefined): ManaPart[] {
  return symbolize(cost).flatMap((part): ManaPart[] => {
    if ('symbol' in part) return [part];
    const text = part.text.trim();
    return text ? [{ text }] : [];
  });
}
