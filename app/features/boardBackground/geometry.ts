/**
 * Path helpers for the background's emblems (#246, #250). Emblems are drawn in
 * a 200 × 200 box centred on (100, 100), mostly as centre-line paths that
 * `brush` or `mono` turn into filled outlines. Everything here is plain maths:
 * neither happy-dom nor Node can measure an SVG path.
 */

export type Point = readonly [number, number];

export const TAU = Math.PI * 2;

/** One decimal place, enough at the tile's scale. */
export const fmt = (n: number) => {
  const s = n.toFixed(1);
  return s === '-0.0' ? '0.0' : s;
};

export const pt = (p: Point) => `${fmt(p[0])} ${fmt(p[1])}`;

/** Points joined by straight lines, not closed. */
export const polyD = (ps: readonly Point[]) =>
  ps.map((q, i) => (i ? 'L' : 'M') + pt(q)).join('');

/** A filled path; `evenodd`, so a closed outline's inner loop is a hole. */
export const path = (d: string, attrs = '') =>
  `<path fill-rule='evenodd' d='${d}'${attrs}/>`;

/** A filled dot. */
export const dot = (x: number, y: number, r: number) =>
  `<circle cx='${fmt(x)}' cy='${fmt(y)}' r='${fmt(r)}'/>`;

/** The point at radius `r` and angle `a` around (cx, cy). */
export const polar = (r: number, a: number, cx = 100, cy = 100): Point => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

/** `p` turned by `a` round (cx, cy). */
export function rotate(p: Point, a: number, cx = 100, cy = 100): Point {
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** The corners of a regular `n`-gon, the first at angle `a0`. */
export const ngon = (
  n: number,
  r: number,
  a0 = -Math.PI / 2,
  cx = 100,
  cy = 100,
) => Array.from({ length: n }, (_, k) => polar(r, a0 + (k * TAU) / n, cx, cy));

/** A circle as a closed polyline. */
export function circle(cx: number, cy: number, r: number, steps = 48): string {
  let d = '';
  for (let i = 0; i < steps; i++)
    d += (i ? 'L' : 'M') + pt(polar(r, (i / steps) * TAU, cx, cy));
  return d + 'Z';
}

/** A diamond `w` wide and `h` tall each side of (cx, cy). */
export const rhombus = (cx: number, cy: number, w: number, h: number) =>
  `M${pt([cx, cy - h])}L${pt([cx + w, cy])}L${pt([cx, cy + h])}L${pt([cx - w, cy])}Z`;

/** A pointed leaf from radius r0 to r1 along angle `a`, `w` radians wide. */
export function lens(r0: number, r1: number, a: number, w: number, skew = 0) {
  const p0 = polar(r0, a);
  const p1 = polar(r1, a);
  const m = (r0 + r1) / 2;
  return `M${pt(p0)}Q${pt(polar(m, a + w + skew))} ${pt(p1)}Q${pt(polar(m, a - w + skew))} ${pt(p0)}Z`;
}

/** An Archimedean spiral from r0 to r1 around (cx, cy). */
export function spiral(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  turns: number,
  dir: 1 | -1,
  a0 = 0,
): string {
  const n = Math.ceil(turns * 28);
  const sweep = turns * TAU;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * sweep;
    d +=
      (i ? 'L' : 'M') +
      pt(polar(r0 + ((r1 - r0) * t) / sweep, a0 + dir * t, cx, cy));
  }
  return d;
}

/** `d` scaled by `k` about (cx, cy), then moved to (tx, ty). Absolute commands only. */
export function transform(
  d: string,
  tx: number,
  ty: number,
  k: number,
  cx = 0,
  cy = 0,
): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) =>
    fmt(i++ % 2 === 0 ? tx + (+m - cx) * k : ty + (+m - cy) * k),
  );
}

/** `n` dots of radius `rad` evenly round a circle of radius `r`, starting at the top. */
export const dotRing = (n: number, r: number, rad: number, offset = 0) =>
  Array.from({ length: n }, (_, k): [number, number, number] => {
    const p = polar(r, (k * TAU) / n - Math.PI / 2 + offset);
    return [p[0], p[1], rad];
  });

const CURVE_STEPS = 16;

/**
 * Motif units between a brush stroke's samples: smooth at the board's
 * closest zoom, and few enough points to keep repainting the tile on zoom
 * cheap.
 */
const BRUSH_SPACING = 4;

/**
 * The points along a path's first subpath, flattened to straight segments,
 * and whether it's closed. Takes absolute M, L, Q, C and Z only, which is all
 * the motifs use.
 */
export function flatten(d: string): { points: Point[]; closed: boolean } {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let closed = false;
  let i = 0;
  let cmd = '';
  let cur: Point = [0, 0];
  const num = () => Number(tokens[i++]);
  const next = (): Point => [num(), num()];

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/^[a-z]$/i.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') {
        closed = true;
        break;
      }
      if (cmd === 'M' && points.length) break;
    }
    if (cmd === 'M' || cmd === 'L') {
      cur = next();
      points.push(cur);
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'Q') {
      const c = next();
      const e = next();
      const s = cur;
      for (let k = 1; k <= CURVE_STEPS; k++) {
        const u = k / CURVE_STEPS;
        const a = (1 - u) ** 2;
        const b = 2 * (1 - u) * u;
        const z = u * u;
        points.push([
          a * s[0] + b * c[0] + z * e[0],
          a * s[1] + b * c[1] + z * e[1],
        ]);
      }
      cur = e;
    } else if (cmd === 'C') {
      const c1 = next();
      const c2 = next();
      const e = next();
      const s = cur;
      for (let k = 1; k <= CURVE_STEPS; k++) {
        const u = k / CURVE_STEPS;
        const a = (1 - u) ** 3;
        const b = 3 * (1 - u) ** 2 * u;
        const c = 3 * (1 - u) * u * u;
        const z = u ** 3;
        points.push([
          a * s[0] + b * c1[0] + c * c2[0] + z * e[0],
          a * s[1] + b * c1[1] + c * c2[1] + z * e[1],
        ]);
      }
      cur = e;
    } else {
      throw new Error(`Unsupported path command near "${t}"`);
    }
  }
  if (closed && points.length) points.push(points[0]!);
  return { points, closed };
}

/** `count + 1` points evenly spaced along a polyline, ends included. */
export function resample(points: readonly Point[], count: number): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[lengths.length - 1]!;
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k <= count; k++) {
    const at = (total * k) / count;
    while (j < points.length - 1 && lengths[j]! < at) j++;
    const a = points[j - 1]!;
    const b = points[j] ?? a;
    const span = lengths[j]! - lengths[j - 1]! || 1;
    const u = Math.min(1, Math.max(0, (at - lengths[j - 1]!) / span));
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

export const pathLength = (points: readonly Point[]) =>
  points.reduce(
    (sum, p, i) =>
      i
        ? sum + Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1])
        : 0,
    0,
  );

/**
 * A centre-line path as a filled brush stroke (#246). Open strokes taper at
 * both ends; closed loops swell and thin as they go round, and come out as an
 * outer and an inner loop for `fill-rule="evenodd"`. `base` is the widest
 * width, `phase` varies where closed loops swell.
 */
export function brush(d: string, base: number, phase: number): string {
  const { points, closed } = flatten(d);
  const length = pathLength(points);
  if (!length) return '';
  const steps = Math.max(14, Math.ceil(length / BRUSH_SPACING));
  const p = resample(points, steps);
  if (closed) p.pop();
  const m = p.length;

  const width = (i: number) => {
    const t = i / (closed ? m : m - 1);
    return closed
      ? base *
          (0.72 +
            0.38 * Math.sin(TAU * 2 * t + phase) +
            0.12 * Math.sin(TAU * 5 * t + phase * 2.3))
      : base * (0.18 + 1.02 * Math.sin(Math.PI * t ** 0.85) ** 0.7);
  };

  return outline(p, closed, width);
}

/**
 * A polyline as a filled outline, `width(i)` wide at point `i`: closed, an
 * outer and an inner loop for `fill-rule="evenodd"`; open, one loop round it.
 */
export function outline(
  p: readonly Point[],
  closed: boolean,
  width: (i: number) => number,
): string {
  const m = p.length;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < m; i++) {
    const a = p[closed ? (i - 1 + m) % m : Math.max(0, i - 1)]!;
    const b = p[closed ? (i + 1) % m : Math.min(m - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const w = width(i) / 2;
    left.push([p[i]![0] + nx * w, p[i]![1] + ny * w]);
    right.push([p[i]![0] - nx * w, p[i]![1] - ny * w]);
  }
  return closed
    ? `${polyD(left)}Z${polyD(right)}Z`
    : `${polyD(left)}${polyD(right.reverse()).replace(/^M/, 'L')}Z`;
}

/** A centre-line path as an even line `w` wide (#250). */
export function mono(d: string, w: number): string {
  const { points, closed } = flatten(d);
  const length = pathLength(points);
  if (!length) return '';
  const p = resample(points, Math.max(8, Math.ceil(length / 2)));
  if (closed) p.pop();
  return outline(p, closed, () => w);
}
