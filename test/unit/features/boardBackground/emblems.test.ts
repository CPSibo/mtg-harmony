import { describe, expect, it } from 'vitest';
import b from 'mana-font/svg/b.svg?raw';
import c from 'mana-font/svg/c.svg?raw';
import g from 'mana-font/svg/g.svg?raw';
import r from 'mana-font/svg/r.svg?raw';
import u from 'mana-font/svg/u.svg?raw';
import w from 'mana-font/svg/w.svg?raw';
import type { MotifKey } from '~/features/boardBackground/colors';
import {
  DEFAULT_EMBLEM_STYLE,
  EMBLEM_STYLES,
  emblemBody,
  emblemStyleName,
  isEmblemStyle,
} from '~/features/boardBackground/emblems';
import { glyphPath } from '~/features/boardBackground/emblems/mana';

const KEYS: MotifKey[] = ['W', 'U', 'B', 'R', 'G', 'C', 'N'];

describe('emblem styles', () => {
  it('lists the styles in the picker order, art deco first and the default', () => {
    expect(EMBLEM_STYLES.map((s) => s.id)).toEqual([
      'deco',
      'stars',
      'knot',
      'stone',
      'brushed',
      'manaOutline',
      'manaTinted',
      'manaSolid',
      'manaCoin',
    ]);
    expect(DEFAULT_EMBLEM_STYLE).toBe('deco');
    expect(emblemStyleName('manaTinted')).toBe(
      'Mana symbols, coloured outline',
    );
  });

  it.each(EMBLEM_STYLES.map((s) => s.id))(
    'draws every colour and the blank slot in %s, with no bad numbers',
    (style) => {
      const bodies = KEYS.map((key) => emblemBody(style, key));
      for (const body of bodies) {
        expect(body).toMatch(/^<(path|circle|mask)/);
        expect(body).not.toMatch(/NaN|Infinity|undefined/);
      }
      // Each colour has its own emblem.
      expect(new Set(bodies.slice(0, 6)).size).toBe(6);
    },
  );

  it('draws each emblem once and keeps it', () => {
    const style = EMBLEM_STYLES.find((s) => s.id === 'knot')!;
    expect(emblemBody('knot', 'W')).toBe(emblemBody('knot', 'W'));
    expect(emblemBody('knot', 'W')).toBe(style.draw('W'));
  });

  it('tells a style from anything else', () => {
    expect(isEmblemStyle('stone')).toBe(true);
    expect(isEmblemStyle('Stone')).toBe(false);
    expect(isEmblemStyle(undefined)).toBe(false);
  });
});

describe('mana symbols', () => {
  // The symbols are scaled by scaling every number and moving only each M,
  // which holds only while every other command is relative.
  it.each([w, u, b, r, g, c])('uses absolute coordinates only for M', (svg) => {
    const commands = glyphPath(svg).match(/[A-Za-z]/g)!;
    expect(commands.filter((k) => k === k.toUpperCase())).toEqual(
      commands.filter((k) => k === 'M'),
    );
  });

  it('centres a symbol on the emblem', () => {
    // The colourless diamond starts at (13.407, 5.933) of a 32 box.
    const body = emblemBody('manaSolid', 'C');
    const [x, y] = /d='M\s*([\d.]+)\s+([\d.]+)/
      .exec(body)!
      .slice(1)
      .map(Number);
    expect(x).toBeCloseTo(100 + (13.407 - 16) * 3.7, 1);
    expect(y).toBeCloseTo(100 + (5.933 - 16) * 3.7, 1);
  });
});
