import { pickImageUri } from '~/composables/useScryfall';
import type { BoardCard, BoardCardModifier } from '~/types/PlayArea';
import type {
  ScryfallCard,
  ScryfallImageUris,
  ScryfallRelatedCard,
} from '~/types/Scryfall';
import { randomUUID } from '~/utils/randomUUID';
import { markRaw } from 'vue';

/**
 * Only the Scryfall fields the app uses (`ScryfallCard`), frozen and kept out
 * of Vue reactivity: they never change, and the full API response is large,
 * so deep watchers and saves would otherwise walk all of it. Data already
 * through here comes back as is.
 */
export function cardData(card: ScryfallCard): ScryfallCard {
  if (Object.isFrozen(card)) return card;
  const front = (face: NonNullable<ScryfallCard['card_faces']>[number]) =>
    Object.freeze(
      pick({
        name: face.name,
        mana_cost: face.mana_cost,
        type_line: face.type_line,
        oracle_text: face.oracle_text,
        power: face.power,
        toughness: face.toughness,
        image_uris: images(face.image_uris),
      }),
    );
  const data = pick({
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost,
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    power: card.power,
    toughness: card.toughness,
    layout: card.layout,
    keywords: card.keywords?.length
      ? Object.freeze([...card.keywords])
      : undefined,
    card_faces: card.card_faces && Object.freeze(card.card_faces.map(front)),
    image_status: card.image_status,
    image_uris: images(card.image_uris),
    scryfall_uri: card.scryfall_uri,
    all_parts: meldParts(card.all_parts),
  }) as ScryfallCard;
  return Object.freeze(markRaw(data));
}

const MELD_COMPONENTS: readonly string[] = ['meld_part', 'meld_result'];

/** The meld parts of `all_parts`, frozen, or nothing on other cards. */
function meldParts(parts: readonly ScryfallRelatedCard[] | undefined) {
  const meld = parts?.filter((p) => MELD_COMPONENTS.includes(p.component));
  if (!meld?.length) return undefined;
  return Object.freeze(
    meld.map(({ id, component, name }) =>
      Object.freeze({ id, component, name }),
    ),
  );
}

/** The image sizes the app uses, frozen. */
function images(uris: ScryfallImageUris | undefined) {
  return (
    uris &&
    Object.freeze(
      pick({
        border_crop: uris.border_crop,
        normal: uris.normal,
        small: uris.small,
      }),
    )
  );
}

/** `value` without its undefined fields, so absent stays absent. */
function pick<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

/**
 * A new card instance for a Scryfall card: untapped, no modifiers, in no
 * stack. Every call gets its own ID, so copies of the same token stay apart.
 * The Scryfall ID stays on `scryfallInfo.id`.
 */
export function createBoardCard(card: ScryfallCard): BoardCard {
  const scryfallCard = cardData(card);
  return {
    id: randomUUID(),
    scryfallInfo: scryfallCard,
    name: scryfallCard.name,
    mana_cost: scryfallCard.mana_cost,
    image_uri: pickImageUri(scryfallCard) ?? '',
    scryfall_uri: scryfallCard.scryfall_uri,
    modifiers: new Set<BoardCardModifier>(),
    tapped: false,
    faceNumber: 0,
  };
}

/**
 * A new instance of `card` with a fresh ID, in no stack. With `keepState`, it
 * keeps the card's own counters, face number and tapped state (counters are
 * copied, not shared); without, it starts fresh like a newly cast card.
 */
export function copyBoardCard(card: BoardCard, keepState: boolean): BoardCard {
  const copy = createBoardCard(card.scryfallInfo);
  if (!keepState) return copy;
  return {
    ...copy,
    tapped: card.tapped,
    faceNumber: card.faceNumber,
    flipped: card.flipped,
    turned: card.turned,
    shownAs: card.shownAs,
    modifiers: new Set([...card.modifiers].map((m) => ({ ...m }))),
  };
}
