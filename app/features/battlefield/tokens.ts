import type { ScryfallCard, ScryfallRelatedCard } from '~/types/Scryfall';

/**
 * The tokens a card makes, from its `all_parts` (#203), once each. Tokens
 * that share a name stay apart (Wurmcoil Engine's two Wurms). A token's own
 * entry is left out: Scryfall lists a token among its own parts. Matched by
 * ID, since a token can make smaller tokens of its own name (Mitotic Slime's
 * Oozes).
 */
export function tokenParts(info: ScryfallCard): ScryfallRelatedCard[] {
  const seen = new Set<string>();
  const tokens: ScryfallRelatedCard[] = [];
  for (const part of info.all_parts ?? []) {
    if (part.component !== 'token') continue;
    if (part.id === info.id || seen.has(part.id)) continue;
    seen.add(part.id);
    tokens.push(part);
  }
  return tokens;
}
