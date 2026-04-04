export type ImageStatus = 'missing' | 'placeholder' | 'lowres' | 'highres_scan';

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost: string;
  image_status: ImageStatus;
  /** Absent when image_status is 'missing'. Individual URIs may be absent for some statuses. */
  image_uris?: {
    border_crop?: string;
    normal?: string;
    small?: string;
  };
  scryfall_uri: string;
}
