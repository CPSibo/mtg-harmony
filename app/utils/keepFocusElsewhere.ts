/**
 * An `onCloseAutoFocus` handler for a non-modal window: it hands focus back to
 * its trigger only if nothing else has taken focus meanwhile (#229).
 *
 * Reka returns focus once the close transition has finished. By then the
 * player may have opened something else, such as the palette, and moving
 * focus out of that would close it. When the closing window had focus, its
 * content is gone by now and focus has fallen back to the body.
 */
export function keepFocusElsewhere(e: Event) {
  const active = document.activeElement;
  if (active && active !== document.body) e.preventDefault();
}
