import { refDebounced } from '@vueuse/core';
import { computed, onScopeDispose, readonly, ref, watch, type Ref } from 'vue';
import { DARK_PALETTE, LIGHT_PALETTE, type BoardColor } from './colors';
import { DEFAULT_EMBLEM_STYLE, type EmblemStyle } from './emblems';
import { bitmapUrl, preloadImages, rasterUrl } from './images';
import { DARK_SPOTLIGHTS, LIGHT_SPOTLIGHTS, spotlightTile } from './spotlights';
import { buildTile, svgUrl } from './tile';

/** How long the backdrop takes to fade out; `.board-layer--hidden` matches it. */
export const FADE_OUT_MS = 150;
/** How long the zoom must rest before the tiles are rendered for it again. */
export const SETTLE_MS = 300;
/** The largest a rendered tile gets, in pixels a side. */
export const MAX_TILE_PX = 4096;
/** How long one level of detail crossfades into the next; `.board-tile--in` matches it. */
export const LOD_FADE_MS = 300;
/** How many levels of detail are kept for the selection, to zoom back to without rendering. */
export const MAX_LEVELS = 6;

export interface BoardBackgroundOptions {
  /** How long to wait for the fade out before swapping. */
  fadeOutMs?: () => number;
  /** Device px per board px, which the tiles are rendered for: zoom × pixel ratio. */
  resolution?: () => number;
  /** How long `resolution` must rest before the tiles are rendered again. */
  settleMs?: number;
  /** How long to keep the old level of detail set while the new one fades in. */
  lodFadeMs?: () => number;
  /** Whether the dark theme shows: only its images are built. */
  dark?: () => boolean;
  /** How the emblems are drawn (#250). */
  emblems?: () => EmblemStyle;
}

export interface BoardBackground {
  /** Whether the themed background is what's set, rather than the grid. */
  themed: Readonly<Ref<boolean>>;
  /** False while the backdrop should be faded out: while loading or swapping. */
  shown: Readonly<Ref<boolean>>;
  /**
   * True while one level of detail crossfades into the next: the old tile is
   * set as `--tile-old` meanwhile.
   */
  fading: Readonly<Ref<boolean>>;
  /** How many crossfades have started, to restart the fade's animation by. */
  fades: Readonly<Ref<number>>;
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
 * tile and, unless `spotlights` is off, a spotlight bitmap, in the colours of
 * the theme that shows (`dark`). Sizes are in board px: the CSS scales them by
 * `--s` and moves them by `--x` and `--y`, which the backdrop sets, so make
 * `target` an element around it (these don't resolve `--s` themselves). None
 * while off.
 *
 * Rebuilt only when the settings or the theme change, and never shown
 * half-built: `shown`
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
 * crossfade in (`fading`), without the backdrop fading out; until then the
 * old ones scale. Up to MAX_LEVELS levels are kept for the selection, so
 * zooming back to one swaps it straight in, without a fade and without
 * waiting for the zoom to rest. Where rendering fails, the SVG is set instead.
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
    lodFadeMs = defaultLodFade,
    dark = () => false,
    emblems = () => DEFAULT_EMBLEM_STYLE,
  }: BoardBackgroundOptions = {},
): BoardBackground {
  const themed = ref(false);
  const shown = ref(!enabled());
  const fading = ref(false);
  const fades = ref(0);
  let vars: Record<string, string> = {};
  let spotBlobs: string[] = [];
  // The lattice the tiles set are rendered from, at what detail, and the
  // levels of detail rendered for it so far, least recently shown first.
  let lattice: Lattice | null = null;
  let levels = new Map<number, Level>();
  // Each settings change bumps `run`, each render `tileRun` and each
  // crossfade `fadeRun`; work that finds its count moved on is stale.
  let run = 0;
  let tileRun = 0;
  let fadeRun = 0;

  // The selection as a string, so an equal one doesn't rebuild; null while
  // off. See `build` for its parts.
  const key = computed(() =>
    enabled()
      ? [
          dark() ? 'D' : 'L',
          emblems(),
          colors().join(''),
          spotlights() ? '+' : '',
        ].join(' ')
      : null,
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
      if (id !== run) return revoke(built.spotBlobs, levelBlobs(built.levels));
      fadeRun++;
      fading.value = false;
      write(target(), target(), vars, built.vars);
      revoke(spotBlobs, levelBlobs(levels));
      ({ vars, spotBlobs, lattice, levels } = built);
      themed.value = selection !== null;
      shown.value = true;
      // The zoom may have moved on while it built.
      void retile();
    },
    { immediate: true },
  );

  /**
   * Sets the tiles for detail `at`: a level kept from before straight away,
   * otherwise rendered and crossfaded in.
   */
  async function retile(at = detail.value) {
    const from = lattice;
    if (!from || from.detail === at) return;
    const id = ++tileRun;
    let level = levels.get(at);
    const fresh = !level;
    if (!level) {
      const rendered = await renderTile(from, at);
      // Kept even if the zoom moved on, as long as it's for this lattice.
      if (from !== lattice) return revoke(rendered.blobs);
      level = rendered;
      levels.set(at, level);
    }
    if (id === tileRun) await preloadImages(Object.values(level.vars));
    if (id !== tileRun || from !== lattice) return;
    // Most recently shown last; drop the least recent beyond the limit,
    // never the level going or coming.
    levels.delete(at);
    levels.set(at, level);
    for (const [key, old] of levels) {
      if (levels.size <= MAX_LEVELS) break;
      if (key === at || key === from.detail) continue;
      levels.delete(key);
      revoke(old.blobs);
    }
    from.detail = at;
    void crossfade(level.vars, fresh);
  }

  /**
   * Sets new tiles, keeping the old ones set while they fade out if `fade`.
   * Only a newly rendered level fades: one kept from before swaps straight in,
   * so zooming back to it shows its detail at once.
   */
  async function crossfade(tiles: Record<string, string>, fade: boolean) {
    const id = ++fadeRun;
    const ms = fade ? lodFadeMs() : 0;
    if (ms <= 0) {
      fading.value = false;
      return setVars({ ...withoutOld(vars), ...tiles });
    }
    setVars({ ...vars, '--tile-old': vars['--tile']!, ...tiles });
    fades.value++;
    fading.value = true;
    await sleep(ms);
    if (id !== fadeRun) return;
    setVars(withoutOld(vars));
    fading.value = false;
  }

  function setVars(next: Record<string, string>) {
    write(target(), target(), vars, next);
    vars = next;
  }

  // A kept level swaps in as soon as the zoom reaches it; rendering waits
  // for the zoom to rest.
  watch(step, (at) => levels.has(at) && retile(at));
  watch(detail, (at) => retile(at));
  watch(target, (el, oldEl) => write(el, oldEl, vars, vars));

  onScopeDispose(() => {
    run++;
    tileRun++;
    fadeRun++;
    revoke(spotBlobs, levelBlobs(levels));
  });

  return {
    themed: readonly(themed),
    shown: readonly(shown),
    fading: readonly(fading),
    fades: readonly(fades),
  };
}

/** One level of detail: its tile, and the blob URLs behind it. */
interface Level {
  vars: Record<string, string>;
  blobs: string[];
}

const levelBlobs = (levels: Map<number, Level>) =>
  [...levels.values()].flatMap((level) => level.blobs);

/** The variables without the old tile a crossfade keeps. */
function withoutOld(vars: Record<string, string>): Record<string, string> {
  const rest = { ...vars };
  delete rest['--tile-old'];
  return rest;
}

/** A selection's lattice tile as an SVG `url()` value, and the detail last rendered at. */
interface Lattice {
  svg: string;
  size: number;
  detail: number;
}

interface Built {
  vars: Record<string, string>;
  spotBlobs: string[];
  lattice: Lattice | null;
  levels: Map<number, Level>;
}

async function empty(): Promise<Built> {
  return { vars: {}, spotBlobs: [], lattice: null, levels: new Map() };
}

/**
 * Builds a selection with the lattice rendered at `detail`. The selection is
 * `D` or `L` for the theme, the emblem style, the colours, then `+` if they're
 * washed with spotlights, separated by spaces.
 */
async function build(selection: string, detail: number): Promise<Built> {
  const [theme, style, colors = '', wash] = selection.split(' ');
  const dark = theme === 'D';
  const washed = wash === '+';
  const picked = [...colors] as BoardColor[];
  const tile = buildTile(
    picked,
    dark ? DARK_PALETTE : LIGHT_PALETTE,
    style as EmblemStyle,
  );
  const lattice: Lattice = { svg: svgUrl(tile.svg), size: tile.size, detail };
  const s = washed
    ? spotlightTile(picked, dark ? DARK_SPOTLIGHTS : LIGHT_SPOTLIGHTS)
    : null;
  const spots = s && (await bitmapUrl(s.pixels, s.pixelWidth, s.pixelHeight));
  const tiles = await renderTile(lattice, detail);
  return {
    vars: {
      ...tiles.vars,
      '--tile-size': `${tile.size}px`,
      '--spots': spots ? `url("${spots}")` : 'none',
      '--spots-width': `${s?.width ?? 0}px`,
      '--spots-height': `${s?.height ?? 0}px`,
    },
    spotBlobs: spots ? [spots] : [],
    lattice,
    levels: new Map([[detail, tiles]]),
  };
}

/** Renders a lattice's tile at `detail`, falling back to the SVG if that fails. */
async function renderTile(lattice: Lattice, detail: number): Promise<Level> {
  const px = Math.min(MAX_TILE_PX, Math.round(lattice.size * detail));
  const url = await rasterUrl(lattice.svg, px);
  return url
    ? { vars: { '--tile': `url("${url}")` }, blobs: [url] }
    : { vars: { '--tile': lattice.svg }, blobs: [] };
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

const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaultFadeOut = () => (reducedMotion() ? 0 : FADE_OUT_MS);
const defaultLodFade = () => (reducedMotion() ? 0 : LOD_FADE_MS);
