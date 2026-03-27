export interface HistoryEntry {
  id: string           // app-generated UUID
  cardName: string
  mana_cost: string
  image_uri: string
  scryfall_uri: string
  fetchedAt: string    // ISO 8601
  wasCast: boolean
}