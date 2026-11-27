import type { MotifKey } from '../colors';
import { TAU, ngon, path, polar, polyD, type Point } from '../geometry';

/** Where the light comes from: the top left. */
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2] as const;
/** How bright a wall in shadow is, as a fill opacity. */
const SHADOW = 0.38;

/** A random number in [-0.5, 0.5), the same every time for a seed. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280 - 0.5;
  };
}

/**
 * A V-groove cut with a chisel from a to b, `w0` wide at a and `w1` at b,
 * pointed at both ends: one wall catches the light and the other is in shadow.
 */
function groove(a: Point, b: Point, w0: number, w1 = w0): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  const tipA: Point = [a[0] - ux * w0 * 0.55, a[1] - uy * w0 * 0.55];
  const tipB: Point = [b[0] + ux * w1 * 0.55, b[1] + uy * w1 * 0.55];
  const side = (s: number): Point[] => [
    tipA,
    [a[0] + (s * nx * w0) / 2, a[1] + (s * ny * w0) / 2],
    [b[0] + (s * nx * w1) / 2, b[1] + (s * ny * w1) / 2],
    tipB,
  ];
  // The wall on the +n side slopes down towards -n, so it faces -n.
  const plusLit = -(nx * LIGHT[0] + ny * LIGHT[1]) > 0;
  const dim = ` fill-opacity='${SHADOW}'`;
  return (
    path(polyD(side(1)) + 'Z', plusLit ? '' : dim) +
    path(polyD(side(-1)) + 'Z', plusLit ? dim : '')
  );
}

/** A chain of grooves through points; widths wander a little, as cut by hand. */
function cut(
  ps: readonly Point[],
  w: number,
  jitter: () => number,
  closed = false,
): string {
  let out = '';
  const n = closed ? ps.length : ps.length - 1;
  for (let i = 0; i < n; i++)
    out += groove(
      ps[i]!,
      ps[(i + 1) % ps.length]!,
      w * (1 + 0.16 * jitter()),
      w * (1 + 0.16 * jitter()),
    );
  return out;
}

const diamond = (cx: number, cy: number, w: number, h: number): Point[] => [
  [cx, cy - h],
  [cx + w, cy],
  [cx, cy + h],
  [cx - w, cy],
];

const unit = (x: number, y: number): Point => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

const centroid = (ps: readonly Point[]): Point => [
  ps.reduce((s, p) => s + p[0], 0) / ps.length,
  ps.reduce((s, p) => s + p[1], 0) / ps.length,
];

/** How bright a face turned towards `f` (a horizontal unit vector) is. */
function shade(f: Point): string {
  const d = (f[0] * LIGHT[0] + f[1] * LIGHT[1] + 1) / 2;
  return (SHADOW + (1 - SHADOW) * d ** 1.4).toFixed(2);
}

/** A sunk pit: a facet from each edge down to the middle, each lit by how it faces. */
function pit(ps: readonly Point[]): string {
  const c = centroid(ps);
  return ps
    .map((a, i) => {
      const b = ps[(i + 1) % ps.length]!;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
      return path(
        polyD([a, b, c]) + 'Z',
        ` fill-opacity='${shade(unit(c[0] - mid[0], c[1] - mid[1]))}'`,
      );
    })
    .join('');
}

/** Short grooves pointing out round a ring. */
const ticks = (n: number, r0: number, r1: number, w: number, off = 0) =>
  Array.from({ length: n }, (_, k) => {
    const a = (k * TAU) / n + off;
    return groove(polar(r0, a), polar(r1, a), w, 1);
  }).join('');

/**
 * Carved stone (#250): bold wedge cuts like chisel strokes, one wall of each
 * groove lit and the other in shadow, with sunk pits shaded by facet.
 */
export const STONE: Readonly<
  Record<MotifKey, (jitter: () => number) => string>
> = {
  /** A sun: an octagon cut round a diamond, long and short wedge rays. */
  W(jitter) {
    let o =
      cut(ngon(8, 17, -Math.PI / 2 + TAU / 16), 4.2, jitter, true) +
      cut(ngon(4, 7, 0), 2.6, jitter, true);
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8 - Math.PI / 2;
      o += groove(polar(27, a), polar(74, a), 11, 0);
      o += groove(polar(30, a + TAU / 16), polar(54, a + TAU / 16), 5, 0);
    }
    return o + ticks(16, 80, 88, 3.2, TAU / 32);
  },

  /** A whirlpool: seven bent blades round a sunk hexagon. */
  U() {
    let o = pit(ngon(6, 11, 0));
    for (let k = 0; k < 7; k++) {
      const a = (k * TAU) / 7;
      o +=
        groove(polar(19, a), polar(46, a + 0.5), 10, 7.5) +
        groove(polar(46, a + 0.5), polar(76, a + 1.15), 7.5, 0);
    }
    return o + ticks(14, 81, 88, 3, 0.1);
  },

  /** A plain skull: a bold outline, sunk sockets and nose, ringed by thorns. */
  B(jitter) {
    let o = '';
    for (let k = 0; k < 14; k++) {
      const a = (k * TAU) / 14;
      o += groove(polar(77, a), polar(89, a), 5.5, 0);
    }
    const skull: Point[] = [
      [100, 46],
      [128, 56],
      [140, 82],
      [134, 110],
      [122, 120],
      [118, 144],
      [82, 144],
      [78, 120],
      [66, 110],
      [60, 82],
      [72, 56],
    ];
    o += cut(skull, 6.2, jitter, true);
    o +=
      pit([
        [70, 88],
        [97, 94],
        [84, 114],
      ]) +
      pit([
        [130, 88],
        [103, 94],
        [116, 114],
      ]) +
      pit([
        [100, 112],
        [92, 128],
        [108, 128],
      ]);
    return o + groove([86, 136], [114, 136], 4.4, 4.4);
  },

  /** A flame cut as a bold outline round a sunk inner flame, with embers. */
  R(jitter) {
    const flame: Point[] = [
      [100, 44],
      [112, 74],
      [126, 64],
      [128, 92],
      [140, 86],
      [138, 120],
      [126, 146],
      [100, 162],
      [74, 146],
      [62, 120],
      [60, 86],
      [72, 92],
      [74, 64],
      [88, 74],
    ];
    let o =
      cut(flame, 6, jitter, true) +
      pit([
        [100, 94],
        [114, 124],
        [112, 142],
        [100, 150],
        [88, 142],
        [86, 124],
      ]);
    for (const [x, y] of [
      [62, 58],
      [138, 54],
      [152, 84],
      [48, 88],
    ] as const)
      o += pit(diamond(x, y, 3, 4.5));
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12 + TAU / 24;
      // None below, where the flame reaches the ring.
      if (Math.sin(a) > 0.75) continue;
      o += groove(polar(80, a), polar(k % 2 ? 86 : 91, a + 0.04), 4, 0);
    }
    return o;
  },

  /** A tree of wedges: a tapering trunk, rising branches, spreading roots. */
  G() {
    let o = groove([100, 152], [100, 32], 19, 0);
    for (const [y, l, w] of [
      [66, 22, 9],
      [88, 32, 11.5],
      [112, 40, 14],
    ] as const)
      o +=
        groove([100, y], [100 - l, y - l * 0.75], w, 0) +
        groove([100, y], [100 + l, y - l * 0.75], w, 0);
    o +=
      groove([100, 140], [72, 160], 10, 0) +
      groove([100, 140], [128, 160], 10, 0);
    for (let k = 0; k < 10; k++) {
      const p = polar(82, (k * TAU) / 10 + TAU / 20);
      if (p[1] > 150) continue;
      o += pit(diamond(p[0], p[1], 3.2, 5));
    }
    return o;
  },

  /** A brilliant cut as grooves: girdle, table, star facets, a sunk point at the heart. */
  C(jitter) {
    const outer = ngon(8, 54, -Math.PI / 2 + TAU / 16);
    const table = ngon(8, 26, -Math.PI / 2);
    let o =
      cut(outer, 5.2, jitter, true) +
      cut(table, 3.8, jitter, true) +
      pit(diamond(100, 100, 6, 9));
    for (let k = 0; k < 8; k++)
      o +=
        groove(table[k]!, outer[k]!, 3.4, 1.2) +
        groove(table[k]!, outer[(k + 7) % 8]!, 3.4, 1.2);
    for (let k = 0; k < 8; k++) {
      const p = polar(82, (k * TAU) / 8 - Math.PI / 2);
      o += pit(diamond(p[0], p[1], 3.2, 5));
    }
    return o;
  },

  /** The blank slot: a sunk diamond, ringed by ticks. */
  N() {
    return pit(diamond(100, 100, 11, 16)) + ticks(16, 81, 87, 2.6, TAU / 32);
  },
};

/** A colour's carved emblem; its hand-cut wobble is the same every time. */
export const stone = (key: MotifKey) =>
  STONE[key](seeded(key.charCodeAt(0) * 37));
