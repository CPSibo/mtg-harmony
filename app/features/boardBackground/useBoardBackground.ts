import { computed, onScopeDispose, readonly, ref, watch, type Ref } from 'vue';
import { DARK_PALETTE, LIGHT_PALETTE, type BoardColor } from './colors';
import { bitmapUrl, preloadImages } from './images';
import {
  DARK_SPOTLIGHTS,
  LIGHT_SPOTLIGHTS,
  spotlightTile,
  type SpotlightPalette,
} from './spotlights';
import { buildTile, svgUrl } from './tile';

/** How long the backdrop takes to fade out; `.board-backdrop--hidden` matches it. */
export const FADE_OUT_MS = 150;

export interface BoardBackgroundOptions {
  /** How long to wait for the fade out before swapping. */
  fadeOutMs?: () => number;
}

export interface BoardBackground {
  /** Whether the themed background is what's set, rather than the grid. */
  themed: Readonly<Ref<boolean>>;
  /** False while the backdrop should be faded out: while loading or swapping. */
  shown: Readonly<Ref<boolean>>;
}

/**
 * Sets the board background's CSS variables on `target` (#246): a lattice
 * tile and, unless `spotlights` is off, a spotlight bitmap for each theme. Sizes are in board px: the CSS
 * scales them by `--s` and moves them by `--x` and `--y`, which the backdrop
 * sets, so make `target` an element around it (these don't resolve `--s`
 * themselves). None while off.
 *
 * Rebuilt only when the settings change, and never shown half-built: `shown`
 * goes false, the backdrop fades out while the new images are built and
 * decoded, then they're swapped in and it fades back in. That covers the
 * build's time, and the first load too. The grid needs nothing built, so it
 * shows straight away when the background starts off.
 *
 * Set here, not through a `:style` binding: Vue re-sets every property of a
 * bound style each time the component renders, and the board renders on
 * every frame of a pan, which would re-set these large images every frame.
 */
export function useBoardBackground(
  target: () => HTMLElement | null | undefined,
  enabled: () => boolean,
  colors: () => readonly BoardColor[],
  spotlights: () => boolean,
  { fadeOutMs = defaultFadeOut }: BoardBackgroundOptions = {},
): BoardBackground {
  const themed = ref(false);
  const shown = ref(!enabled());
  let vars: Record<string, string> = {};
  let blobs: string[] = [];
  // Each change bumps this; a build that finds it moved on is stale.
  let run = 0;

  // The selection as a string, so an equal one doesn't rebuild; null while off.
  const key = computed(() =>
    enabled() ? `${colors().join('')}${spotlights() ? '+' : ''}` : null,
  );

  watch(
    key,
    async (selection) => {
      const id = ++run;
      // Off, and the grid already showing (or about to be): nothing to swap.
      if (selection === null && !themed.value) return void (shown.value = true);
      const wasShown = shown.value;
      shown.value = false;
      const [built] = await Promise.all([
        selection === null
          ? empty()
          : afterPaint().then(() => build(selection)),
        wasShown ? sleep(fadeOutMs()) : undefined,
      ]);
      if (id === run)
        await preloadImages(Object.values(built.vars).filter(isUrl));
      if (id !== run)
        return built.blobs.forEach((url) => URL.revokeObjectURL(url));
      write(target(), target(), vars, built.vars);
      blobs.forEach((url) => URL.revokeObjectURL(url));
      ({ vars, blobs } = built);
      themed.value = selection !== null;
      shown.value = true;
    },
    { immediate: true },
  );

  watch(target, (el, oldEl) => write(el, oldEl, vars, vars));

  onScopeDispose(() => {
    run++;
    blobs.forEach((url) => URL.revokeObjectURL(url));
  });

  return { themed: readonly(themed), shown: readonly(shown) };
}

interface Built {
  vars: Record<string, string>;
  blobs: string[];
}

async function empty(): Promise<Built> {
  return { vars: {}, blobs: [] };
}

/** Builds `selection`'s colours, and their spotlights if it ends in `+`. */
async function build(selection: string): Promise<Built> {
  const washed = selection.endsWith('+');
  const picked = [...selection.replace('+', '')] as BoardColor[];
  const tile = buildTile(picked, DARK_PALETTE);
  const blobs: string[] = [];
  const spots = async (palette: SpotlightPalette) => {
    const s = washed ? spotlightTile(picked, palette) : null;
    const url = s && (await bitmapUrl(s.pixels, s.pixelWidth, s.pixelHeight));
    if (url) blobs.push(url);
    return { url: url ? `url("${url}")` : 'none', s };
  };
  const dark = await spots(DARK_SPOTLIGHTS);
  const light = await spots(LIGHT_SPOTLIGHTS);
  return {
    vars: {
      '--tile-dark': svgUrl(tile.svg),
      '--tile-light': svgUrl(buildTile(picked, LIGHT_PALETTE).svg),
      '--tile-size': `${tile.size}px`,
      '--spots-dark': dark.url,
      '--spots-light': light.url,
      '--spots-width': `${dark.s?.width ?? 0}px`,
      '--spots-height': `${dark.s?.height ?? 0}px`,
    },
    blobs,
  };
}

/** Moves the variables from `oldVars` on `oldEl` to `newVars` on `el`. */
function write(
  el: HTMLElement | null | undefined,
  oldEl: HTMLElement | null | undefined,
  oldVars: Record<string, string>,
  newVars: Record<string, string>,
) {
  if (oldEl)
    for (const name in oldVars)
      if (oldEl !== el || !(name in newVars)) oldEl.style.removeProperty(name);
  if (!el) return;
  for (const name in newVars)
    if (el.style.getPropertyValue(name) !== newVars[name])
      el.style.setProperty(name, newVars[name]!);
}

const isUrl = (value: string) => value.startsWith('url(');

const sleep = (ms: number) =>
  ms > 0 ? new Promise((done) => setTimeout(done, ms)) : undefined;

/** Waits for the next frame, so a fade starts before the build blocks the thread. */
const afterPaint = () =>
  new Promise<void>((done) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => setTimeout(done))
      : setTimeout(done),
  );

function defaultFadeOut(): number {
  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : FADE_OUT_MS;
}
