export interface ScryfallCard {
  id: string
  name: string
  mana_cost: string
  image_uris: {
    normal: string
  }
  scryfall_uri: string
}

export interface Modifier {
  id: string
  type: string    // e.g. '+1/+1', 'flying', 'haste'
  symbol: string  // keyrune or mana CSS class
}

export interface GridCard {
  id: string
  name: string
  mana_cost: string
  image_uri: string    // from ScryfallCard.image_uris.normal
  scryfall_uri: string
  instanceCount: number  // minimum 1
  modifiers: Modifier[]
}

export interface HistoryEntry {
  id: string           // app-generated UUID
  cardName: string
  scryfall_uri: string
  fetchedAt: string    // ISO 8601
  wasCast: boolean
}

export type SlotSize = 'small' | 'medium' | 'large'

export interface AppSettings {
  slotSize: SlotSize           // controls card dimensions; column/row count auto-fits to screen
  gridDisplayMode: 'full' | 'compact'
  onDeckExpanded: boolean
}
