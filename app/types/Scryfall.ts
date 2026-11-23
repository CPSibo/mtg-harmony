/** The image sizes the app uses. */
export interface ScryfallImageUris {
  border_crop?: string;
  normal?: string;
  small?: string;
}

export type ImageStatus = 'missing' | 'placeholder' | 'lowres' | 'highres_scan';

/** One face of a multi-face card, as Scryfall sends it. */
export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  /** Only on cards with an image per face (double-faced cards). */
  image_uris?: ScryfallImageUris;
}

/**
 * A card related to another, from Scryfall's `all_parts`. The app keeps only
 * meld parts: the two halves (`meld_part`) and what they meld into
 * (`meld_result`).
 */
export interface ScryfallRelatedCard {
  id: string;
  /** `meld_part` or `meld_result` once trimmed; Scryfall also sends `token` and `combo_piece`. */
  component: string;
  name: string;
}

export interface ScryfallCard {
  id: string;
  /** Shared by every printing of the card; Swap art lists printings by it. */
  oracle_id?: string;
  name: string;
  mana_cost: string;
  /** Shown when card images are off. */
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  /** How the card is printed: normal, split, flip, transform, modal_dfc, planar� */
  layout?: string;
  keywords?: string[];
  /** Each face of a double-faced, split or adventure card. */
  card_faces?: ScryfallCardFace[];
  image_status: ImageStatus;
  /**
   * Absent when image_status is 'missing', and on double-faced cards, whose
   * images are on each face. Individual URIs may be absent for some statuses.
   */
  image_uris?: ScryfallImageUris;
  scryfall_uri: string;
  /** On meld cards: both halves and the melded card (#143). */
  all_parts?: ScryfallRelatedCard[];
}
