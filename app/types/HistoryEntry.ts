export interface HistoryEntry {
  id: string           // app-generated UUID
  cardName: string
  scryfall_uri: string
  fetchedAt: string    // ISO 8601
  wasCast: boolean
}