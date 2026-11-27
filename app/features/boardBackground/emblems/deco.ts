import type { MotifKey } from '../colors';
import {
  TAU,
  circle,
  fmt,
  mono,
  path,
  polar,
  polyD,
  pt,
  rhombus,
  type Point,
} from '../geometry';

/** The main line width, and the fine one for alternate rays and details. */
const LINE = 1.7;
const FINE = 1.1;

const line = (d: string, w = LINE) => path(mono(d, w));
const seg = (a: Point, b: Point, w = LINE) => line(`M${pt(a)}L${pt(b)}`, w);
const gem = (x: number, y: number, w: number, h: number) =>
  path(rhombus(x, y, w, h));

/** An arc of radius `r` round (cx, cy), as a polyline. */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
  polyD(
    Array.from({ length: 41 }, (_, i) =>
      polar(r, a0 + ((a1 - a0) * i) / 40, cx, cy),
    ),
  );

/** A closed crescent: the part of circle 1 outside circle 2. */
function crescent(c1: Point, r1: number, c2: Point, r2: number): string {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  const base = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  const h1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const h2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const outer = Array.from({ length: 41 }, (_, i) =>
    polar(r1, base + h1 + ((TAU - 2 * h1) * i) / 40, c1[0], c1[1]),
  );
  const inner = Array.from({ length: 41 }, (_, i) =>
    polar(r2, base + Math.PI + h2 - (2 * h2 * i) / 40, c2[0], c2[1]),
  );
  return polyD([...outer, ...inner.slice(1, -1)]) + 'Z';
}

/** A four-point glint. */
const glint = (x: number, y: number, r: number) =>
  path(
    polyD(
      Array.from({ length: 8 }, (_, k) =>
        polar(k % 2 ? r * 0.25 : r, (k * TAU) / 8 - Math.PI / 2, x, y),
      ),
    ) + 'Z',
  );

/** A square on point with each corner stepped out, `r` to its points. */
function stepped(r: number, s: number): string {
  const ps: Point[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4 - Math.PI / 2;
    const v = polar(r, a);
    const u = [Math.cos(a), Math.sin(a)] as const;
    const q = [-u[1], u[0]] as const;
    const e = (sp: number, out: number): Point => [
      v[0] - u[0] * s + sp * q[0] * s + u[0] * out,
      v[1] - u[1] * s + sp * q[1] * s + u[1] * out,
    ];
    ps.push(e(-1, 0), e(-1, s * 0.5), e(1, s * 0.5), e(1, 0));
  }
  return polyD(ps) + 'Z';
}

/**
 * Art deco (#250): crisp, even lines, nested outlines, fans of rays and
 * stepped forms, with small diamonds filling the space round them.
 */
export const DECO: Readonly<Record<MotifKey, () => string>> = {
  /** A sunburst: a double disc and a fan of long and short rays. */
  W() {
    let o = line(circle(100, 100, 12)) + line(circle(100, 100, 20));
    for (let k = 0; k < 32; k++) {
      const a = (k * TAU) / 32;
      const far = k % 2 ? 56 : k % 4 ? 68 : 80;
      o += seg(polar(26, a), polar(far, a), k % 2 ? FINE : LINE);
    }
    return o;
  },

  /** A frozen fountain: a triple jet, sprays falling either side, a stepped basin. */
  U() {
    let o =
      seg([96, 128], [96, 34]) +
      seg([100, 128], [100, 26]) +
      seg([104, 128], [104, 34]);
    for (const [k, top] of [
      [0, 40],
      [1, 54],
      [2, 68],
    ] as const) {
      const reach = 36 + k * 14;
      const end = 108;
      for (const s of [1, -1])
        o += line(
          `M100 ${top}C${fmt(100 + s * reach * 0.4)} ${top - 10} ${100 + s * reach} ${top + 4} ${100 + s * reach} ${end}`,
        );
    }
    o +=
      seg([50, 128], [150, 128]) +
      seg([60, 138], [140, 138]) +
      seg([72, 148], [128, 148]);
    for (const x of [64, 78, 122, 136]) o += gem(x, 116, 1.8, 3);
    return o;
  },

  /** A crescent moon, outlined twice, with a glint, small stars and a fan of rays. */
  B() {
    let o =
      line(crescent([94, 100], 50, [114, 90], 42)) +
      line(crescent([94, 100], 43, [114, 90], 49), FINE) +
      glint(130, 104, 12) +
      gem(146, 74, 2, 3) +
      gem(122, 136, 1.6, 2.4) +
      gem(156, 108, 1.8, 2.7) +
      gem(136, 54, 1.6, 2.4);
    for (let i = 0; i < 9; i++) {
      const a = 2.68 - 1.1 + (2.2 * i) / 8;
      o += seg(
        polar(58, a, 94, 100),
        polar(i % 2 ? 64 : 70, a, 94, 100),
        i % 2 ? FINE : LINE,
      );
    }
    return o;
  },

  /** A nested flame on a base line, rays above and diamonds beside it. */
  R() {
    let o = '';
    for (const k of [0, 1, 2, 3]) {
      const s = 1 - k * 0.22;
      const top = 30 + k * 20;
      const bot = 150 - k * 6;
      const w = 50 * s;
      o += line(
        `M100 ${fmt(top)}C${fmt(100 + w * 0.2)} ${fmt(top + 30 * s)} ${fmt(100 + w)} ${fmt(bot - 50 * s)} ${fmt(100 + w * 0.5)} ${fmt(bot)}` +
          `L${fmt(100 - w * 0.5)} ${fmt(bot)}C${fmt(100 - w)} ${fmt(bot - 50 * s)} ${fmt(100 - w * 0.2)} ${fmt(top + 30 * s)} 100 ${fmt(top)}Z`,
      );
    }
    for (const da of [-0.42, 0, 0.42])
      o += seg(
        polar(14, -Math.PI / 2 + da, 100, 34),
        polar(da ? 22 : 26, -Math.PI / 2 + da, 100, 34),
        da ? FINE : LINE,
      );
    for (const [x, y, r] of [
      [56, 100, 3],
      [144, 100, 3],
      [64, 66, 2.2],
      [136, 66, 2.2],
    ] as const)
      o += gem(x, y, r * 0.66, r);
    return (
      o +
      seg([52, 158], [148, 158]) +
      gem(44, 158, 2.4, 3.6) +
      gem(156, 158, 2.4, 3.6)
    );
  },

  /** A fan palm: ribs fanning from the crown, a scalloped edge, a ringed trunk. */
  G() {
    const c: Point = [100, 118];
    const n = 9;
    const a0 = -Math.PI + 0.25;
    const a1 = -0.25;
    const angle = (i: number) => a0 + ((a1 - a0) * i) / (n - 1);
    let o = '';
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      o += seg(polar(14, a, ...c), polar(66, a, ...c));
      o += seg(
        polar(72, a, ...c),
        polar(i % 2 ? 78 : 84, a, ...c),
        i % 2 ? FINE : LINE,
      );
      if (i < n - 1)
        o += line(
          `M${pt(polar(66, a, ...c))}Q${pt(polar(56, angle(i + 0.5), ...c))} ${pt(polar(66, angle(i + 1), ...c))}`,
        );
    }
    o +=
      line(arc(c[0], c[1], 26, a0, a1)) +
      seg([96, 120], [96, 164]) +
      seg([104, 120], [104, 164]);
    for (const y of [134, 146, 158]) o += seg([92, y], [108, y], FINE);
    return (
      o +
      seg([78, 168], [122, 168], FINE) +
      gem(70, 168, 1.8, 2.7) +
      gem(130, 168, 1.8, 2.7)
    );
  },

  /** A stepped square gem: nested squares on point, rays from the points. */
  C() {
    let o =
      line(stepped(60, 12)) +
      line(rhombus(100, 100, 34, 34)) +
      line(rhombus(100, 100, 20, 20)) +
      line(rhombus(100, 100, 7, 7));
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4 - Math.PI / 2;
      for (const da of [-0.32, 0, 0.32])
        o += seg(
          polar(66, a + da * 0.4),
          polar(da ? 76 : 84, a + da * 0.4),
          da ? FINE : LINE,
        );
    }
    return o;
  },

  /** The blank slot: a small diamond in a diamond. */
  N() {
    return line(rhombus(100, 100, 12, 12)) + line(rhombus(100, 100, 5, 5));
  },
};
