import b from 'mana-font/svg/b.svg?raw';
import c from 'mana-font/svg/c.svg?raw';
import g from 'mana-font/svg/g.svg?raw';
import r from 'mana-font/svg/r.svg?raw';
import u from 'mana-font/svg/u.svg?raw';
import w from 'mana-font/svg/w.svg?raw';
import type { BoardColor, MotifKey } from '../colors';
import { TAU, dot, dotRing } from '../geometry';

/** Each colour's mana symbol, as mana-font draws it in a 32 × 32 box. */
const SOURCES: Readonly<Record<BoardColor, string>> = {
  W: w,
  U: u,
  B: b,
  R: r,
  G: g,
  C: c,
};

/** The path data of a mana-font SVG, which is one path. */
export function glyphPath(svg: string): string {
  const d = /\sd="([^"]+)"/.exec(svg)?.[1];
  if (!d) throw new Error('No path in the mana symbol');
  return d;
}

/** How much a symbol is scaled up, and the blank slot's smaller diamond. */
const SCALE = 3.7;
const BLANK_SCALE = 1.2;

/**
 * A symbol scaled by `k` and centred on (100, 100). The scale is worked into
 * the path rather than set as a transform, so the emblem's colour gradient,
 * set in the tile's units, still lines up. The symbols use absolute
 * coordinates only for M and everything else is relative, so scaling every
 * number and moving the Ms is enough; `glyphPath`'s test checks that holds.
 */
function glyph(key: MotifKey, k: number, attrs = ''): string {
  const offset = 100 - 16 * k;
  let command = '';
  const d = glyphPath(SOURCES[key === 'N' ? 'C' : key]).replace(
    /[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g,
    (token) => {
      if (/[A-Za-z]/.test(token)) {
        command = token;
        return token;
      }
      const v = Number(token) * k + (command === 'M' ? offset : 0);
      return ` ${v.toFixed(2)}`;
    },
  );
  return `<path${attrs} d='${d}'/>`;
}

const scale = (key: MotifKey) => (key === 'N' ? BLANK_SCALE : SCALE);

/** A ring of dots round the edge, like the other styles' details. */
const ring = () =>
  dotRing(16, 84, 1.9, TAU / 32)
    .map(([x, y, rad]) => dot(x, y, rad))
    .join('');

/**
 * The official mana symbols from mana-font (#250), in four treatments. They
 * are Wizards of the Coast's, used under the Fan Content Policy the About
 * dialog cites (#167). Nothing picked shows a small colourless symbol.
 */
export const MANA = {
  /** Traced as an even line. */
  outline: (key: MotifKey) =>
    glyph(
      key,
      scale(key),
      ` fill='none' stroke-width='2.3' stroke-linejoin='round'`,
    ) + ring(),

  /** A strong outline round a faint fill of the same colour. */
  tinted: (key: MotifKey) =>
    glyph(
      key,
      scale(key),
      ` fill-opacity='0.28' stroke-width='2.6' stroke-linejoin='round'`,
    ) + ring(),

  /** Filled. */
  solid: (key: MotifKey) => glyph(key, scale(key)) + ring(),

  /** Knocked out of a disc, the way a symbol sits on a card. */
  coin(key: MotifKey) {
    if (key === 'N') return glyph(key, BLANK_SCALE) + ring();
    const id = `coin-${key}`;
    return (
      `<mask id='${id}' maskUnits='userSpaceOnUse' x='0' y='0' width='200' height='200'>` +
      `<circle cx='100' cy='100' r='62' fill='white'/><g fill='black'>${glyph(key, 2.9)}</g></mask>` +
      `<circle cx='100' cy='100' r='62' mask='url(#${id})'/>` +
      ring()
    );
  },
};
