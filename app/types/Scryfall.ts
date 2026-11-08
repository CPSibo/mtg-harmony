export type ImageStatus = 'missing' | 'placeholder' | 'lowres' | 'highres_scan';

/** One face of a multi-face card, as Scryfall sends it. */
export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
}

export interface ScryfallCard {
  id: string;
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
  /** Absent when image_status is 'missing'. Individual URIs may be absent for some statuses. */
  image_uris?: {
    border_crop?: string;
    normal?: string;
    small?: string;
  };
  scryfall_uri: string;
}
