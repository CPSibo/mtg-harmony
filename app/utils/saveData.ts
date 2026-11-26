/**
 * Whether the browser asks sites to save data (#242). Read once when settings
 * start from their defaults; a saved choice always wins over it.
 *
 * - `prefers-reduced-data` is the standard media feature. No browser ships it
 *   unflagged yet; an unknown feature never matches, so it's safe to ask now.
 * - `navigator.connection.saveData` is Chromium's Data Saver (the same switch
 *   that sends the `Save-Data` header).
 */
export function prefersReducedData(): boolean {
  if (globalThis.matchMedia?.('(prefers-reduced-data: reduce)').matches) {
    return true;
  }
  const connection = (
    globalThis.navigator as { connection?: { saveData?: boolean } } | undefined
  )?.connection;
  return connection?.saveData === true;
}
