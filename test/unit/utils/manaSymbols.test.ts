import { describe, expect, it } from 'vitest';
import { manaSymbols } from '~/utils/manaSymbols';

describe('manaSymbols', () => {
  it('turns a mana cost into mana-font classes, one per symbol', () => {
    expect(manaSymbols('{2}{W}{U}')).toEqual([
      { symbol: 'ms ms-2 ms-cost', label: '2' },
      { symbol: 'ms ms-w ms-cost', label: 'W' },
      { symbol: 'ms ms-u ms-cost', label: 'U' },
    ]);
  });

  it('handles hybrid, Phyrexian, X and two-digit symbols', () => {
    expect(
      manaSymbols('{X}{10}{W/U}{2/B}{G/P}').map(
        (s) => 'symbol' in s && s.symbol,
      ),
    ).toEqual([
      'ms ms-x ms-cost',
      'ms ms-10 ms-cost',
      'ms ms-wu ms-cost',
      'ms ms-2b ms-cost',
      'ms ms-gp ms-cost',
    ]);
  });

  it('keeps the // between the faces of a split card', () => {
    expect(manaSymbols('{R} // {1}{G}')).toEqual([
      { symbol: 'ms ms-r ms-cost', label: 'R' },
      { text: '//' },
      { symbol: 'ms ms-1 ms-cost', label: '1' },
      { symbol: 'ms ms-g ms-cost', label: 'G' },
    ]);
  });

  it('gives nothing for no cost', () => {
    expect(manaSymbols('')).toEqual([]);
    expect(manaSymbols(undefined)).toEqual([]);
  });
});
