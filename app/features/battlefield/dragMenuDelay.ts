// No imports: the settings store reads these, and dragMenu reads the store.

/** How long a dragged card hovers over a stack before the menu opens. */
export const DRAG_MENU_DELAY_MS = 1000;
/** The range the setting allows, in ms. */
export const MIN_DRAG_MENU_DELAY_MS = 250;
export const MAX_DRAG_MENU_DELAY_MS = 3000;

export function isDragMenuDelay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    value >= MIN_DRAG_MENU_DELAY_MS &&
    value <= MAX_DRAG_MENU_DELAY_MS
  );
}
