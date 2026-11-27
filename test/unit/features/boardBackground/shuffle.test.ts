import { describe, expect, it } from 'vitest';
import {
  CORNER_NEIGHBOURS,
  SIDE_NEIGHBOURS,
  shuffleLayout,
} from '~/features/boardBackground/shuffle';

const PERIOD = 4;

function matches(
  n: number,
  neighbours: readonly (readonly [number, number])[],
  seed = 7,
) {
  const layout = shuffleLayout(n, PERIOD, seed);
  let count = 0;
  for (let u = 0; u < layout.size; u++)
    for (let v = 0; v < layout.size; v++) {
      if ((u + v) % 2) continue;
      for (const [du, dv] of neighbours)
        if (layout.at(u, v) === layout.at(u + du, v + dv)) count++;
    }
  return count;
}

describe('shuffleLayout', () => {
  it.each([2, 3, 4, 5, 6])(
    'keeps neighbours sharing a side apart with %i colours',
    (n) => {
      expect(matches(n, SIDE_NEIGHBOURS)).toBe(0);
    },
  );

  it.each([4, 5, 6])(
    'keeps corner neighbours apart too with %i colours',
    (n) => {
      expect(matches(n, CORNER_NEIGHBOURS)).toBe(0);
    },
  );

  it.each([2, 3, 4, 5, 6])('uses every one of %i colours', (n) => {
    const layout = shuffleLayout(n, PERIOD, 7);
    const used = new Set<number>();
    for (let u = 0; u < layout.size; u++)
      for (let v = u % 2; v < layout.size; v += 2) used.add(layout.at(u, v));
    expect([...used].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  it('gives the same layout from the same seed', () => {
    const a = shuffleLayout(5, PERIOD, 7);
    const b = shuffleLayout(5, PERIOD, 7);
    const cells = (l: typeof a) =>
      Array.from({ length: l.size * l.size }, (_, i) =>
        l.at(Math.floor(i / l.size), i % l.size),
      );
    expect(cells(a)).toEqual(cells(b));
  });

  it('wraps across the block', () => {
    const layout = shuffleLayout(4, PERIOD, 7);
    expect(layout.at(-1, 1)).toBe(layout.at(layout.size - 1, 1));
    expect(layout.at(2, layout.size + 2)).toBe(layout.at(2, 2));
  });
});
