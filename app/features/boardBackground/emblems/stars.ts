import type { MotifKey } from '../colors';
import { TAU, dot, mono, path, polar, polyD, pt } from '../geometry';

/** A star: x, y and its magnitude, 1 faint to 4 brightest. */
type Star = readonly [number, number, number];
/** A link between two stars, by index. */
type Link = readonly [number, number];

/** A four-point glint. */
const sparkle = (x: number, y: number, r: number) =>
  path(
    polyD(
      Array.from({ length: 8 }, (_, k) =>
        polar(k % 2 ? r * 0.28 : r, (k * TAU) / 8 - Math.PI / 2, x, y),
      ),
    ) + 'Z',
  );

const star = ([x, y, m]: Star) =>
  m >= 3
    ? sparkle(x, y, m * 3) + dot(x, y, m * 0.75)
    : dot(x, y, m === 2 ? 3.3 : 2.3);

/**
 * A star chart: hairline links that stop short of each star, the stars, then
 * `dust` faint specks round the edge, placed from `seed`.
 */
function chart(
  stars: readonly Star[],
  links: readonly Link[],
  dust: number,
  seed: number,
): string {
  let o = '';
  for (const [i, j] of links) {
    const a = stars[i]!;
    const b = stars[j]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    const ga = 3.5 + a[2] * 1.8;
    const gb = 3.5 + b[2] * 1.8;
    if (l <= ga + gb) continue;
    const from = [a[0] + (dx * ga) / l, a[1] + (dy * ga) / l] as const;
    const to = [b[0] - (dx * gb) / l, b[1] - (dy * gb) / l] as const;
    o += path(mono(`M${pt(from)}L${pt(to)}`, 1.1));
  }
  o += stars.map(star).join('');
  let s = seed * 7919;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < dust; k++) {
    const p = polar(74 + rnd() * 16, rnd() * TAU);
    o += dot(p[0], p[1], 0.9 + rnd() * 1.1);
  }
  return o;
}

/** A closed loop of links through stars `from` to `to`. */
const loop = (from: number, to: number): Link[] =>
  Array.from({ length: to - from + 1 }, (_, k) => [
    from + k,
    k === to - from ? from : from + k + 1,
  ]);

/**
 * Constellations (#250): each emblem as a star chart, a few magnitudes of
 * star with glints on the brightest, hairline links and star dust round the
 * edge.
 */
export const STARS: Readonly<Record<MotifKey, () => string>> = {
  /** A sunburst: a bright centre, a ring of stars, rays out to bright points. */
  W() {
    const stars: Star[] = [[100, 100, 4]];
    const links: Link[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8 - Math.PI / 2;
      stars.push([...polar(34, a), k % 2 ? 1 : 2]);
      stars.push([...polar(k % 2 ? 56 : 66, a), k % 2 ? 1 : 3]);
    }
    for (let k = 0; k < 8; k++)
      links.push([1 + 2 * k, 1 + 2 * ((k + 1) % 8)], [1 + 2 * k, 2 + 2 * k]);
    return chart(stars, links, 14, 1);
  },

  /** A whirlpool: one arm of stars spiralling in to a bright eye. */
  U() {
    const stars: Star[] = [];
    const links: Link[] = [];
    for (let i = 0; i <= 10; i++) {
      const m = i === 0 ? 3 : i % 3 === 0 ? 2 : 1;
      stars.push([...polar(76 - i * 6.2, -Math.PI / 2 + i * 0.72), m]);
      if (i) links.push([i - 1, i]);
    }
    stars.push([100, 100, 4]);
    links.push([10, 11]);
    return chart(stars, links, 12, 2);
  },

  /** A skull: a ring of stars, two bright eyes over a nose. */
  B() {
    const stars: Star[] = [
      [100, 54, 2],
      [126, 62, 1],
      [138, 86, 2],
      [132, 110, 1],
      [120, 134, 2],
      [100, 138, 1],
      [80, 134, 2],
      [68, 110, 1],
      [62, 86, 2],
      [74, 62, 1],
      [84, 98, 4],
      [116, 98, 4],
      [100, 118, 1],
    ];
    return chart(stars, [...loop(0, 9), [10, 12], [11, 12]], 18, 3);
  },

  /** A flame: an outline of stars round a bright heart. */
  R() {
    const stars: Star[] = [
      [100, 45, 3],
      [112, 75, 1],
      [128, 65, 2],
      [132, 99, 1],
      [134, 125, 2],
      [100, 155, 1],
      [66, 125, 2],
      [68, 99, 1],
      [72, 65, 2],
      [88, 75, 1],
      [100, 119, 4],
      [100, 91, 1],
    ];
    return chart(stars, [...loop(0, 9), [10, 11], [11, 0]], 14, 4);
  },

  /** A tree: a trunk of stars, branches either side, roots below. */
  G() {
    const stars: Star[] = [
      [100, 156, 2],
      [100, 128, 1],
      [100, 100, 2],
      [100, 70, 1],
      [100, 44, 3],
      [72, 82, 2],
      [128, 82, 2],
      [64, 108, 1],
      [136, 108, 1],
      [78, 158, 1],
      [122, 158, 1],
      [80, 56, 1],
      [120, 56, 1],
    ];
    const links: Link[] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [2, 6],
      [5, 7],
      [6, 8],
      [0, 9],
      [0, 10],
      [3, 11],
      [3, 12],
    ];
    return chart(stars, links, 12, 5);
  },

  /** A gem: a diamond in a diamond, joined at the points, round a bright centre. */
  C() {
    const stars: Star[] = [
      [100, 44, 3],
      [136, 100, 2],
      [100, 156, 3],
      [64, 100, 2],
      [100, 78, 1],
      [116, 100, 1],
      [100, 122, 1],
      [84, 100, 1],
      [100, 100, 4],
    ];
    const links: Link[] = [
      ...loop(0, 3),
      ...loop(4, 7),
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    return chart(stars, links, 14, 6);
  },

  /** The blank slot: a small diamond of stars. */
  N() {
    const stars: Star[] = [
      [100, 84, 1],
      [112, 100, 1],
      [100, 116, 1],
      [88, 100, 1],
      [100, 100, 2],
    ];
    return chart(stars, loop(0, 3), 16, 7);
  },
};
