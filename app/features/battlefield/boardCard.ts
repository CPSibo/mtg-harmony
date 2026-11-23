import { pickImageUri } from '~/composables/useScryfall';
import { isModifierKey, type ModifierKey } from '~/types/MtgConcepts';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard, ScryfallImageUris } from '~/types/Scryfall';
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
  }) as ScryfallCard;
  return Object.freeze(markRaw(data));
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
  return {
    id: randomUUID(),
    scryfallInfo: cardData(card),
    modifiers: new Map(),
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
    modifiers: new Map(card.modifiers),
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';
const isOptional = (v: unknown, type: 'boolean') =>
  v === undefined || typeof v === type;

/**
 * A card from saved data, ready to use, or null if it isn't a card this
 * version can show (#154). Its Scryfall data goes through `cardData()`;
 * counters this version doesn't know are dropped rather than the card. The
 * stack back-reference is left to the caller.
 */
export function readSavedCard(value: unknown): BoardCard | null {
  if (!isObject(value)) return null;
  const info = value.scryfallInfo;
  if (
    typeof value.id !== 'string' ||
    !isObject(info) ||
    typeof info.id !== 'string' ||
    typeof info.name !== 'string' ||
    typeof value.tapped !== 'boolean' ||
    typeof value.faceNumber !== 'number' ||
    !(value.modifiers instanceof Map) ||
    !isOptional(value.flipped, 'boolean') ||
    !isOptional(value.turned, 'boolean') ||
    ![undefined, 'art', 'text'].includes(value.shownAs as string)
  )
    return null;

  const card = value as unknown as BoardCard;
  try {
    card.scryfallInfo = cardData(card.scryfallInfo);
  } catch {
    return null; // Faces or images of the wrong shape.
  }
  for (const [key, count] of value.modifiers as Map<unknown, unknown>)
    if (
      !isModifierKey(key) ||
      !Number.isInteger(count) ||
      (count as number) < 1
    )
      card.modifiers.delete(key as ModifierKey);
  return card;
}

/** The card's front image, or '' when its printing has none. */
export function cardImage(card: BoardCard): string {
  return pickImageUri(card.scryfallInfo) ?? '';
}
