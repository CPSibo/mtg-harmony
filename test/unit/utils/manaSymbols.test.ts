import { describe, expect, it } from 'vitest';
import { manaSymbols, rulesText, symbolize } from '~/utils/manaSymbols';

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

describe('symbolize', () => {
  it('keeps the text around symbols in rules text', () => {
    expect(symbolize('{T}: Add {G}.')).toEqual([
      { symbol: 'ms ms-tap ms-cost', label: 'T' },
      { text: ': Add ' },
      { symbol: 'ms ms-g ms-cost', label: 'G' },
      { text: '.' },
    ]);
  });

  it('knows untap and energy', () => {
    expect(symbolize('{Q}{E}').map((p) => 'symbol' in p && p.symbol)).toEqual([
      'ms ms-untap ms-cost',
      'ms ms-e ms-cost',
    ]);
  });
});

describe('rulesText', () => {
  it('marks text in parentheses, symbols too, as reminder text', () => {
    expect(rulesText('Flying (Pay {1}.)\nDraw.')).toEqual([
      { text: 'Flying ' },
      { text: '(Pay ', reminder: true },
      { symbol: 'ms ms-1 ms-cost', label: '1', reminder: true },
      { text: '.)', reminder: true },
      { text: '\nDraw.' },
    ]);
  });

  it('is empty without text', () => {
    expect(rulesText(undefined)).toEqual([]);
  });
});
