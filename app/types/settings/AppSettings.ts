export interface AppSettings {
  /** Whether the On-Deck slot is expanded. */
  onDeckExpanded: boolean;

  /** Whether the background prefetch queue is active. */
  prefetchEnabled: boolean;

  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. */
  imagesEnabled: boolean;
}
