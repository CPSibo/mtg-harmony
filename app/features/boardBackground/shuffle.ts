/** A seeded random number generator (mulberry32), giving numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Neighbours sharing a side with cell (u, v) on the diagonal lattice. */
export const SIDE_NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Neighbours meeting cell (u, v) at a corner. */
export const CORNER_NEIGHBOURS: readonly (readonly [number, number])[] = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

/** A colour layout over a size × size torus of lattice cells. */
export interface Layout {
  size: number;
  /** The colour index of cell (u, v), wrapping across the block's edges. */
  at(u: number, v: number): number;
}

/**
 * Lays `n` colours over a `2 × period` square block of lattice cells, so that
 * no two cells sharing a side match, nor (with 4 or more colours) two meeting
 * at a corner, wrapping across the block's edges (#246). Cells are (u, v) with
 * u + v even. Solved with min-conflicts from a fixed seed, so the same input
 * always gives the same layout. Two colours can only be a checkerboard.
 */
export function shuffleLayout(n: number, period: number, seed: number): Layout {
  const size = 2 * period;
  const key = (u: number, v: number) => mod(u, size) * size + mod(v, size);
  const table = new Int8Array(size * size);
  const at = (u: number, v: number) => table[key(u, v)]!;

  if (n === 2) {
    // Every side neighbour is one column over, so alternating by column is
    // the checkerboard.
    for (let u = 0; u < size; u++)
      for (let v = 0; v < size; v++) table[key(u, v)] = mod(u, 2);
    return { size, at };
  }

  const random = seededRandom(seed * 1000 + n * 31 + period);
  const cells: [number, number][] = [];
  for (let u = 0; u < size; u++)
    for (let v = 0; v < size; v++)
      if ((u + v) % 2 === 0) {
        cells.push([u, v]);
        table[key(u, v)] = Math.floor(random() * n);
      }
  if (n < 2) return { size, at };

  const neighbours =
    n >= 4 ? [...SIDE_NEIGHBOURS, ...CORNER_NEIGHBOURS] : SIDE_NEIGHBOURS;
  const conflicts = (u: number, v: number, c: number) =>
    neighbours.reduce(
      (sum, [du, dv]) => sum + (at(u + du, v + dv) === c ? 1 : 0),
      0,
    );

  for (let i = 0; i < 6000; i++) {
    const bad = cells.filter(([u, v]) => conflicts(u, v, at(u, v)) > 0);
    if (!bad.length) break;
    const [u, v] = bad[Math.floor(random() * bad.length)]!;
    let best: number[] = [];
    let fewest = Infinity;
    for (let c = 0; c < n; c++) {
      const k = conflicts(u, v, c);
      if (k < fewest) {
        fewest = k;
        best = [c];
      } else if (k === fewest) best.push(c);
    }
    table[key(u, v)] = best[Math.floor(random() * best.length)]!;
  }
  return { size, at };
}
