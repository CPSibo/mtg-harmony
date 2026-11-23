import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard, ScryfallRelatedCard } from '~/types/Scryfall';

/**
 * What a meld half melds into, from its `all_parts`. Nothing for the melded
 * card itself or for cards that don't meld.
 */
export function meldResult(
  info: ScryfallCard,
): ScryfallRelatedCard | undefined {
  const parts = info.all_parts;
  if (!parts?.some((p) => p.component === 'meld_part' && p.name === info.name))
    return undefined;
  return parts.find((p) => p.component === 'meld_result');
}

/**
 * The other half `card` melds with, among `cards`: the card named as the
 * other meld part that melds into the same card. Matched by name, so any
 * printing of it counts.
 */
export function findMeldPartner(
  card: BoardCard,
  cards: Iterable<BoardCard>,
): BoardCard | undefined {
  const info = card.scryfallInfo;
  const result = meldResult(info);
  if (!result) return undefined;
  const other = info.all_parts!.find(
    (p) => p.component === 'meld_part' && p.name !== info.name,
  );
  if (!other) return undefined;
  for (const candidate of cards) {
    if (candidate.id === card.id) continue;
    if (candidate.scryfallInfo.name !== other.name) continue;
    if (meldResult(candidate.scryfallInfo)?.name === result.name)
      return candidate;
  }
  return undefined;
}
