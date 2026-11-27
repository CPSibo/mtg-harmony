import type { MotifKey } from '../colors';
import {
  TAU,
  dot,
  dotRing,
  mono,
  ngon,
  outline,
  path,
  pathLength,
  polar,
  polyD,
  pt,
  resample,
  rhombus,
  rotate,
  type Point,
} from '../geometry';

/**
 * The ribbon's width, each edge line's width, and how far past the over
 * strand's edge the under strand's edges stop.
 */
const BAND = 8.5;
const EDGE = 1.9;
const MARGIN = 2.6;
/** How close an under strand's edge may come to the over strand's middle. */
const REACH = BAND / 2 + EDGE / 2 + MARGIN;

/** A closed polyline resampled to points about `ds` apart. */
function densify(ps: readonly Point[], ds = 1.2): Point[] {
  const loop = [...ps, ps[0]!];
  const n = Math.max(12, Math.round(pathLength(loop) / ds));
  const out = resample(loop, n);
  out.pop();
  return out;
}

/** A polygon with each corner rounded off over `rad` units either side. */
function roundPoly(ps: readonly Point[], rad: number, steps = 8): Point[] {
  const out: Point[] = [];
  ps.forEach((v, i) => {
    const a = ps[(i - 1 + ps.length) % ps.length]!;
    const b = ps[(i + 1) % ps.length]!;
    const towards = (q: Point): Point => {
      const l = Math.hypot(q[0] - v[0], q[1] - v[1]);
      const r = Math.min(rad, l * 0.45);
      return [v[0] + ((q[0] - v[0]) * r) / l, v[1] + ((q[1] - v[1]) * r) / l];
    };
    const s0 = towards(a);
    const s1 = towards(b);
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const p = (1 - u) ** 2;
      const q = 2 * (1 - u) * u;
      const z = u * u;
      out.push([
        p * s0[0] + q * v[0] + z * s1[0],
        p * s0[1] + q * v[1] + z * s1[1],
      ]);
    }
  });
  return out;
}

/** `n` points of a curve `f` from t0 to t1, the end left off. */
const param = (f: (t: number) => Point, n: number, t0 = 0, t1 = TAU) =>
  Array.from({ length: n }, (_, i) => f(t0 + ((t1 - t0) * i) / n));

const ellipse = (cx: number, cy: number, a: number, b: number, turn: number) =>
  param(
    (t) => rotate([cx + a * Math.cos(t), cy + b * Math.sin(t)], turn, cx, cy),
    240,
  );

/** Where segments pq and rs cross, as fractions along each, if they do. */
function segHit(p: Point, q: Point, r: Point, s: Point) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? ([t, u] as const) : null;
}

/** How far p is from segment ab. */
function segDist(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** One strand's end of a crossing: which curve, and how far along it in samples. */
interface End {
  c: number;
  i: number;
}
interface Crossing {
  ends: readonly [End, End];
  /** Which end passes over; -1 until set. */
  over: number;
}
interface Pass {
  x: Crossing;
  /** Which of the crossing's ends this is. */
  k: number;
  i: number;
}

/** Every crossing between and within the curves, each once. */
function crossings(curves: readonly Point[][]): Crossing[] {
  const hits: Crossing[] = [];
  for (let a = 0; a < curves.length; a++)
    for (let b = a; b < curves.length; b++) {
      const A = curves[a]!;
      const B = curves[b]!;
      for (let i = 0; i < A.length; i++)
        for (let j = a === b ? i + 3 : 0; j < B.length; j++) {
          // A curve's last segments meet its first.
          if (a === b && i === 0 && j >= B.length - 2) continue;
          const h = segHit(
            A[i]!,
            A[(i + 1) % A.length]!,
            B[j]!,
            B[(j + 1) % B.length]!,
          );
          if (!h) continue;
          const x: Crossing = {
            ends: [
              { c: a, i: i + h[0] },
              { c: b, i: j + h[1] },
            ],
            over: -1,
          };
          const near = hits.some((y) =>
            y.ends.every(
              (e, k) =>
                e.c === x.ends[k]!.c && Math.abs(e.i - x.ends[k]!.i) < 3,
            ),
          );
          if (!near) hits.push(x);
        }
    }
  return hits;
}

/**
 * Closed curves woven over and under (#250): crossings alternate along each
 * strand, and each strand is a ribbon drawn as its two edge lines. Where a
 * strand passes under, each edge stops where it meets the over strand's band,
 * plus a margin, so the gap follows the over strand at any crossing angle.
 */
function weave(raw: readonly Point[][]): string {
  const curves = raw.map((c) => densify(c));
  const passes: Pass[][] = curves.map(() => []);
  for (const x of crossings(curves))
    x.ends.forEach((e, k) => passes[e.c]!.push({ x, k, i: e.i }));
  for (const list of passes) list.sort((p, q) => p.i - q.i);

  // Walk each strand, alternating over and under, keeping crossings already set.
  for (const list of passes) {
    let phase = 0;
    const first = list.findIndex((e) => e.x.over >= 0);
    if (first >= 0) {
      const e = list[first]!;
      phase = ((e.x.over === e.k ? 0 : 1) - (first % 2) + 2) % 2;
    }
    list.forEach((e, n) => {
      if (e.x.over < 0) e.x.over = (n + phase) % 2 === 0 ? e.k : 1 - e.k;
    });
  }

  let out = '';
  curves.forEach((P, c) => {
    const m = P.length;
    const wrap = (i: number) => ((i % m) + m) % m;
    const normal = (i: number): Point => {
      const a = P[wrap(i - 1)]!;
      const b = P[wrap(i + 1)]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    };
    for (const s of [1, -1]) {
      const E = P.map((p, i): Point => {
        const n = normal(i);
        return [p[0] + (s * n[0] * BAND) / 2, p[1] + (s * n[1] * BAND) / 2];
      });
      // Each sample's distance from the over strand where it passes under.
      const dist = new Array<number>(m).fill(Infinity);
      for (const e of passes[c]!) {
        if (e.x.over === e.k) continue;
        const o = e.x.ends[1 - e.k]!;
        const Q = curves[o.c]!;
        const q0 = Math.round(o.i);
        const over = Array.from(
          { length: 61 },
          (_, j) => Q[(((q0 + j - 30) % Q.length) + Q.length) % Q.length]!,
        );
        // Only the stretch of edge at this crossing: start from the sample
        // nearest the over strand and widen while still inside its band.
        const i0 = Math.round(e.i);
        const memo = new Map<number, number>();
        const at = (j: number) => {
          let v = memo.get(j);
          if (v === undefined) {
            v = Infinity;
            const p = E[wrap(i0 + j)]!;
            for (let k = 0; k < over.length - 1; k++)
              v = Math.min(v, segDist(p, over[k]!, over[k + 1]!));
            memo.set(j, v);
          }
          return v;
        };
        let best = 0;
        for (let j = -12; j <= 12; j++) if (at(j) < at(best)) best = j;
        if (at(best) >= REACH) continue;
        for (const step of [1, -1])
          for (let j = best; Math.abs(j - best) <= 45; j += step) {
            dist[wrap(i0 + j)] = Math.min(dist[wrap(i0 + j)]!, at(j));
            if (at(j) >= REACH) break;
          }
      }
      const cut = dist.map((d) => d < REACH);
      if (!cut.includes(true)) {
        out += path(outline(E, true, () => EDGE));
        continue;
      }
      // Where the edge crosses the cut line between two samples.
      const between = (i: number, j: number): Point => {
        const t = (dist[i]! - REACH) / (dist[i]! - dist[j]!);
        if (!Number.isFinite(t)) return E[i]!;
        return [
          E[i]![0] + (E[j]![0] - E[i]![0]) * t,
          E[i]![1] + (E[j]![1] - E[i]![1]) * t,
        ];
      };
      const start = cut.indexOf(true);
      let run: Point[] = [];
      for (let k = 1; k <= m; k++) {
        const i = (start + k) % m;
        const prev = wrap(i - 1);
        if (!cut[i]) {
          if (!run.length) run.push(between(i, prev));
          run.push(E[i]!);
        } else if (run.length) {
          run.push(between(prev, i));
          if (run.length > 2) out += path(outline(run, false, () => EDGE));
          run = [];
        }
      }
    }
  });
  return out;
}

const dots = (ring: [number, number, number][]) =>
  ring.map(([x, y, r]) => dot(x, y, r)).join('');

/**
 * Knotwork (#250): woven ribbons of one band width, each filling about the
 * same circle, ringed by small details.
 */
export const KNOT: Readonly<Record<MotifKey, () => string>> = {
  /** An eight-point star rosette, one strand woven through itself. */
  W() {
    const rosette = param(
      (t) => polar(50 + 22 * Math.cos((8 * t) / 3), t),
      1400,
      0,
      3 * TAU,
    );
    return weave([rosette]) + dots(dotRing(16, 87, 1.8, TAU / 32));
  },

  /** A triquetra woven through a ring, ringed by small wave crests. */
  U() {
    const triquetra = param(
      (t) => [
        100 + 23 * (Math.sin(t) + 2 * Math.sin(2 * t)),
        100 - 23 * (Math.cos(t) - 2 * Math.cos(2 * t)),
      ],
      700,
    );
    let o = weave([triquetra, param((t) => polar(44, t), 400)]);
    for (let k = 0; k < 9; k++) {
      const a = (k * TAU) / 9 + Math.PI / 2 + TAU / 18;
      o += path(
        mono(
          `M${pt(polar(80, a - 0.13))}Q${pt(polar(89, a - 0.02))} ${pt(polar(84, a + 0.08))}` +
            `Q${pt(polar(81, a + 0.1))} ${pt(polar(82, a + 0.03))}`,
          1.9,
        ),
      );
    }
    return o;
  },

  /** A valknut: three interlocked triangles, ringed by thorns. */
  B() {
    const triangles = [0, 1, 2].map((k) => {
      // Off-centre by a sixth of a turn, so no two edges lie on each other.
      const c = polar(19, Math.PI / 2 + Math.PI / 6 + (k * TAU) / 3, 100, 104);
      return roundPoly(ngon(3, 54, -Math.PI / 2, c[0], c[1]), 10);
    });
    let o = weave(triangles);
    for (let k = 0; k < 14; k++) {
      const a = (k * TAU) / 14;
      o += path(
        polyD([polar(82, a - 0.06), polar(90, a), polar(82, a + 0.06)]) + 'Z',
      );
    }
    return o;
  },

  /** A flame: a tall tongue and two leaning ones, through a ring at the base. */
  R() {
    const tongue: Point[] = [
      [0, 0],
      [26, 56],
      [30, 94],
      [0, 118],
      [-30, 94],
      [-26, 56],
    ];
    const place = (s: number, turn: number, x: number, y: number) =>
      roundPoly(
        tongue.map(([u, v]) =>
          rotate([x + u * s, y + (v - 118) * s], turn, x, y),
        ),
        20 * s,
      );
    return (
      weave([
        place(1.16, 0, 100, 158),
        place(0.76, -0.52, 80, 158),
        place(0.76, 0.52, 120, 158),
        param((t) => polar(29, t, 100, 128), 300),
      ]) +
      dots([
        [58, 52, 2.2],
        [142, 48, 1.8],
        [154, 84, 1.5],
        [46, 88, 1.6],
      ])
    );
  },

  /** Four leaves through a ring, four buds between them, berries round the edge. */
  G() {
    const leaves = [0, 1, 2, 3].map((k) => {
      const a = (k * TAU) / 4 - Math.PI / 4;
      const c = polar(40, a);
      return ellipse(c[0], c[1], 38, 15, a);
    });
    const buds = [0, 1, 2, 3].map((k) => {
      const a = (k * TAU) / 4;
      const c = polar(58, a);
      return ellipse(c[0], c[1], 22, 10, a);
    });
    const berries = [0, 1, 2, 3].flatMap((k) => {
      const a = (k * TAU) / 4 - Math.PI / 4;
      return [-0.22, 0.22].map((d): [number, number, number] => [
        ...polar(84, a + d),
        2,
      ]);
    });
    return (
      weave([...leaves, ...buds, param((t) => polar(44, t), 300)]) +
      dots(berries)
    );
  },

  /** Two squares, one turned, woven round a small knot, a diamond off each corner. */
  C() {
    const square = (a: number) => roundPoly(ngon(4, 72, a), 12);
    let o = weave([
      square(-Math.PI / 4),
      square(0),
      ellipse(100, 100, 27, 11, 0),
      ellipse(100, 100, 27, 11, Math.PI / 2),
    ]);
    for (let k = 0; k < 8; k++) {
      const p = polar(84, (k * TAU) / 8);
      o += path(rhombus(p[0], p[1], 2.4, 3.6));
    }
    return o;
  },

  /** The blank slot: a small knot of two loops, ringed by dots. */
  N() {
    return (
      weave([
        ellipse(100, 100, 22, 9, 0),
        ellipse(100, 100, 22, 9, Math.PI / 2),
      ]) + dots(dotRing(16, 86, 1.6, TAU / 32))
    );
  },
};
