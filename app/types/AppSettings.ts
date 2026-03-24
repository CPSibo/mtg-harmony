export type SlotSize = 'small' | 'medium' | 'large'

export interface AppSettings {
  slotSize: SlotSize           // controls card dimensions; column/row count auto-fits to screen
  gridDisplayMode: 'full' | 'compact'
  onDeckExpanded: boolean
  prefetchEnabled: boolean     // whether the background prefetch queue is active
  wakeLockEnabled: boolean     // whether the Screen Wake Lock API is requested
}