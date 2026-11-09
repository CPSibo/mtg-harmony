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
  /** Each face of a double-faced, split or adventure card. */
  card_faces?: ScryfallCardFace[];
  image_status: ImageStatus;
  /**
   * Absent when image_status is 'missing', and on double-faced cards, whose
   * images are on each face. Individual URIs may be absent for some statuses.
   */
  image_uris?: ScryfallImageUris;
  scryfall_uri: string;
}
