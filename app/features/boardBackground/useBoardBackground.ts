import { computed, watch } from 'vue';
import { DARK_PALETTE, LIGHT_PALETTE, type BoardColor } from './colors';
import { DARK_SPOTLIGHTS, LIGHT_SPOTLIGHTS, spotlightTile } from './spotlights';
import { buildTile, svgUrl } from './tile';

/**
 * Sets the board background's CSS variables on `target` (#246): a lattice
 * tile and a spotlight tile for each theme, as SVG. Rebuilt only when the
 * selection changes. Sizes are in board px: the CSS scales them by `--s` and
 * moves them by `--x` and `--y`, which the backdrop sets, so make `target` an
 * element around it (these don't resolve `--s` themselves). None while off.
 *
 * Set here, not through a `:style` binding: Vue re-sets every property of a
 * bound style each time the component renders, and the board renders on
 * every frame of a pan, which would re-set these large images every frame.
 */
export function useBoardBackground(
  target: () => HTMLElement | null | undefined,
  enabled: () => boolean,
  colors: () => readonly BoardColor[],
): void {
  const variables = computed((): Record<string, string> => {
    if (!enabled()) return {};
    const selection = colors();
    const tile = buildTile(selection, DARK_PALETTE);
    const spotsDark = spotlightTile(selection, DARK_SPOTLIGHTS);
    const spotsLight = spotlightTile(selection, LIGHT_SPOTLIGHTS);
    return {
      '--tile-dark': svgUrl(tile.svg),
      '--tile-light': svgUrl(buildTile(selection, LIGHT_PALETTE).svg),
      '--tile-size': `${tile.size}px`,
      '--spots-dark': spotsDark ? svgUrl(spotsDark.svg) : 'none',
      '--spots-light': spotsLight ? svgUrl(spotsLight.svg) : 'none',
      '--spots-width': `${spotsDark?.width ?? 0}px`,
      '--spots-height': `${spotsDark?.height ?? 0}px`,
    };
  });

  watch(
    [target, variables],
    ([el, vars], [oldEl, oldVars]) => {
      if (oldEl)
        for (const name in oldVars)
          if (oldEl !== el || !(name in vars)) oldEl.style.removeProperty(name);
      if (!el) return;
      for (const name in vars)
        if (el.style.getPropertyValue(name) !== vars[name])
          el.style.setProperty(name, vars[name]!);
    },
    { immediate: true },
  );
}
