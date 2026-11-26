import { refDebounced } from '@vueuse/core';
import { computed, onScopeDispose, readonly, ref, watch, type Ref } from 'vue';
import { DARK_PALETTE, LIGHT_PALETTE, type BoardColor } from './colors';
import { bitmapUrl, preloadImages, rasterUrl } from './images';
import {
  DARK_SPOTLIGHTS,
  LIGHT_SPOTLIGHTS,
  spotlightTile,
  type SpotlightPalette,
} from './spotlights';
import { buildTile, svgUrl } from './tile';

/** How long the backdrop takes to fade out; `.board-backdrop--hidden` matches it. */
export const FADE_OUT_MS = 150;
/** How long the zoom must rest before the tiles are rendered for it again. */
export const SETTLE_MS = 300;
/** The largest a rendered tile gets, in pixels a side. */
export const MAX_TILE_PX = 4096;

export interface BoardBackgroundOptions {
  /** How long to wait for the fade out before swapping. */
  fadeOutMs?: () => number;
  /** Device px per board px, which the tiles are rendered for: zoom × pixel ratio. */
  resolution?: () => number;
  /** How long `resolution` must rest before the tiles are rendered again. */
  settleMs?: number;
}

export interface BoardBackground {
  /** Whether the themed background is what's set, rather than the grid. */
  themed: Readonly<Ref<boolean>>;
  /** False while the backdrop should be faded out: while loading or swapping. */
  shown: Readonly<Ref<boolean>>;
}

/**
 * The detail tiles are rendered at for a resolution: the next power of √2 up,
 * so a zoom re-renders them only now and then, and they're never scaled down
 * by more than √2.
 */
export function detailStep(resolution: number): number {
  return Math.SQRT2 ** Math.ceil(2 * Math.log2(Math.max(resolution, 1 / 64)));
}

/**
 * Sets the board background's CSS variables on `target` (#246): a lattice
 * tile and, unless `spotlights` is off, a spotlight bitmap for each theme.
 * Sizes are in board px: the CSS scales them by `--s` and moves them by `--x`
 * and `--y`, which the backdrop sets, so make `target` an element around it
 * (these don't resolve `--s` themselves). None while off.
 *
 * Rebuilt only when the settings change, and never shown half-built: `shown`
 * goes false, the backdrop fades out while the new images are built and
 * decoded, then they're swapped in and it fades back in. That covers the
 * build's time, and the first load too. The grid needs nothing built, so it
 * shows straight away when the background starts off.
 *
 * The lattice is built as SVG but set as a bitmap rendered from it, at the
 * detail `resolution` needs (see `detailStep`). Panning moves the background
 * every frame, and a browser may draw a large SVG with clips and masks from
 * scratch each time, where a bitmap is only a texture. Once the zoom rests at
 * a resolution that needs another step, the tiles are rendered again and
 * swapped in without a fade; until then the old ones scale. Where rendering
 * fails, the SVG is set instead.
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
  {
    fadeOutMs = defaultFadeOut,
    resolution = () => 1,
    settleMs = SETTLE_MS,
  }: BoardBackgroundOptions = {},
): BoardBackground {
  const themed = ref(false);
  const shown = ref(!enabled());
  let vars: Record<string, string> = {};
  let spotBlobs: string[] = [];
  let tileBlobs: string[] = [];
  // The lattice the tiles set are rendered from, and at what detail.
  let lattice: Lattice | null = null;
  // Each settings change bumps `run`, and each render `tileRun`; a build or
  // render that finds its count moved on is stale.
  let run = 0;
  let tileRun = 0;

  // The selection as a string, so an equal one doesn't rebuild; null while off.
  const key = computed(() =>
    enabled() ? `${colors().join('')}${spotlights() ? '+' : ''}` : null,
  );
  const step = computed(() => detailStep(resolution()));
  const detail = settleMs > 0 ? refDebounced(step, settleMs) : step;

  watch(
    key,
    async (selection) => {
      const id = ++run;
      tileRun++;
      // Off, and the grid already showing (or about to be): nothing to swap.
      if (selection === null && !themed.value) return void (shown.value = true);
      const wasShown = shown.value;
      shown.value = false;
      const [built] = await Promise.all([
        selection === null
          ? empty()
          : afterPaint().then(() => build(selection, detail.value)),
        wasShown ? sleep(fadeOutMs()) : undefined,
      ]);
      if (id === run)
        await preloadImages(Object.values(built.vars).filter(isUrl));
      if (id !== run) return revoke(built.spotBlobs, built.tileBlobs);
      write(target(), target(), vars, built.vars);
      revoke(spotBlobs, tileBlobs);
      ({ vars, spotBlobs, tileBlobs, lattice } = built);
      themed.value = selection !== null;
      shown.value = true;
      // The zoom may have moved on while it built.
      void retile();
    },
    { immediate: true },
  );

  async function retile() {
    const from = lattice;
    const at = detail.value;
    if (!from || from.detail === at) return;
    const id = ++tileRun;
    const tiles = await renderTiles(from, at);
    const current = () => id === tileRun && from === lattice;
    if (current()) await preloadImages(Object.values(tiles.vars));
    if (!current()) return revoke(tiles.blobs);
    const next = { ...vars, ...tiles.vars };
    write(target(), target(), vars, next);
    revoke(tileBlobs);
    vars = next;
    tileBlobs = tiles.blobs;
    from.detail = at;
  }

  watch(detail, retile);
  watch(target, (el, oldEl) => write(el, oldEl, vars, vars));

  onScopeDispose(() => {
    run++;
    tileRun++;
    revoke(spotBlobs, tileBlobs);
  });

  return { themed: readonly(themed), shown: readonly(shown) };
}

/** A selection's lattice tiles as SVG `url()` values, and the detail last rendered at. */
interface Lattice {
  dark: string;
  light: string;
  size: number;
  detail: number;
}

interface Built {
  vars: Record<string, string>;
  spotBlobs: string[];
  tileBlobs: string[];
  lattice: Lattice | null;
}

async function empty(): Promise<Built> {
  return { vars: {}, spotBlobs: [], tileBlobs: [], lattice: null };
}

/**
 * Builds `selection`'s colours, and their spotlights if it ends in `+`, with
 * the lattice rendered at `detail`.
 */
async function build(selection: string, detail: number): Promise<Built> {
  const washed = selection.endsWith('+');
  const picked = [...selection.replace('+', '')] as BoardColor[];
  const tile = buildTile(picked, DARK_PALETTE);
  const lattice: Lattice = {
    dark: svgUrl(tile.svg),
    light: svgUrl(buildTile(picked, LIGHT_PALETTE).svg),
    size: tile.size,
    detail,
  };
  const spotBlobs: string[] = [];
  const spots = async (palette: SpotlightPalette) => {
    const s = washed ? spotlightTile(picked, palette) : null;
    const url = s && (await bitmapUrl(s.pixels, s.pixelWidth, s.pixelHeight));
    if (url) spotBlobs.push(url);
    return { url: url ? `url("${url}")` : 'none', s };
  };
  const dark = await spots(DARK_SPOTLIGHTS);
  const light = await spots(LIGHT_SPOTLIGHTS);
  const tiles = await renderTiles(lattice, detail);
  return {
    vars: {
      ...tiles.vars,
      '--tile-size': `${tile.size}px`,
      '--spots-dark': dark.url,
      '--spots-light': light.url,
      '--spots-width': `${dark.s?.width ?? 0}px`,
      '--spots-height': `${dark.s?.height ?? 0}px`,
    },
    spotBlobs,
    tileBlobs: tiles.blobs,
    lattice,
  };
}

/** Renders a lattice's tiles at `detail`, falling back to the SVG for any that fail. */
async function renderTiles(lattice: Lattice, detail: number) {
  const px = Math.min(MAX_TILE_PX, Math.round(lattice.size * detail));
  const blobs: string[] = [];
  const render = async (svg: string) => {
    const url = await rasterUrl(svg, px);
    if (!url) return svg;
    blobs.push(url);
    return `url("${url}")`;
  };
  const dark = await render(lattice.dark);
  const light = await render(lattice.light);
  return { vars: { '--tile-dark': dark, '--tile-light': light }, blobs };
}

function revoke(...lists: string[][]) {
  for (const list of lists) for (const url of list) URL.revokeObjectURL(url);
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
