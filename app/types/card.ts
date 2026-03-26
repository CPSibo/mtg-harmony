/** Quality level of images available for a Scryfall card. */
export type ImageStatus = 'missing' | 'placeholder' | 'lowres' | 'highres_scan'

export interface ScryfallCard {
  id: string
  name: string
  mana_cost: string
  image_status: ImageStatus
  /** Absent when image_status is 'missing'. Individual URIs may be absent for some statuses. */
  image_uris?: {
    border_crop?: string
    normal?: string
    small?: string
  }
  scryfall_uri: string
}

export interface Modifier {
  id: string
  type: string    // e.g. '+1/+1', 'flying', 'haste'
  symbol: string  // mana-font CSS class (e.g. 'ms ms-ability-flying')
}

export interface GridCard {
  id: string
  name: string
  mana_cost: string
  image_uri: string    // from ScryfallCard.image_uris.normal
  scryfall_uri: string
  instanceCount: number  // minimum 1
  modifiers: Modifier[]
  tapped: boolean
}
