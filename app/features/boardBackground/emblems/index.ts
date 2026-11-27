import type { MotifKey } from '../colors';
import { brushed } from './brushed';
import { DECO } from './deco';
import { KNOT } from './knot';
import { MANA } from './mana';
import { STARS } from './stars';
import { stone } from './stone';

/** A look for the board background's emblems (#250). */
export type EmblemStyle =
  | 'deco'
  | 'stars'
  | 'knot'
  | 'stone'
  | 'brushed'
  | 'manaOutline'
  | 'manaTinted'
  | 'manaSolid'
  | 'manaCoin';

interface EmblemStyleInfo {
  id: EmblemStyle;
  name: string;
  draw: (key: MotifKey) => string;
}

/**
 * Every style, in the order the picker lists them. Each emblem is drawn in a
 * 200 × 200 box centred on (100, 100) as fills for the tile to colour, and
 * none draws a solid outer circle: the lattice already rings each medallion.
 */
export const EMBLEM_STYLES: readonly EmblemStyleInfo[] = Object.freeze([
  { id: 'deco', name: 'Art deco', draw: (key) => DECO[key]() },
  { id: 'stars', name: 'Constellations', draw: (key) => STARS[key]() },
  { id: 'knot', name: 'Knotwork', draw: (key) => KNOT[key]() },
  { id: 'stone', name: 'Carved stone', draw: stone },
  { id: 'brushed', name: 'Brushed line art', draw: brushed },
  { id: 'manaOutline', name: 'Mana symbols, outlined', draw: MANA.outline },
  {
    id: 'manaTinted',
    name: 'Mana symbols, coloured outline',
    draw: MANA.tinted,
  },
  { id: 'manaSolid', name: 'Mana symbols, solid', draw: MANA.solid },
  { id: 'manaCoin', name: 'Mana symbols, coin', draw: MANA.coin },
]);

export const DEFAULT_EMBLEM_STYLE: EmblemStyle = 'deco';

export const isEmblemStyle = (v: unknown): v is EmblemStyle =>
  EMBLEM_STYLES.some((s) => s.id === v);

export const emblemStyleName = (style: EmblemStyle) =>
  EMBLEM_STYLES.find((s) => s.id === style)!.name;

const bodies = new Map<string, string>();

/**
 * An emblem's SVG, as paths and circles without a fill, for a `<g>` to
 * colour. Some styles weave or brush every path, which takes a while, so each
 * emblem is drawn once and kept.
 */
export function emblemBody(style: EmblemStyle, key: MotifKey): string {
  const id = `${style}:${key}`;
  let body = bodies.get(id);
  if (body === undefined) {
    body = EMBLEM_STYLES.find((s) => s.id === style)!.draw(key);
    bodies.set(id, body);
  }
  return body;
}
