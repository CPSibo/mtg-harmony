import type { MotifKey } from './colors';
import {
  TAU,
  brush,
  circle,
  dotRing,
  fmt,
  lens,
  polar,
  rhombus,
  spiral,
  transform,
} from './geometry';

/** A centre-line path and its weight, relative to the base brush width. */
type Stroke = readonly [d: string, weight: number];
/** A dot: centre x, centre y, radius. */
type Dot = readonly [number, number, number];

interface MotifDrawing {
  strokes: Stroke[];
  dots: Dot[];
}

const pt = (p: readonly [number, number]) => `${fmt(p[0])} ${fmt(p[1])}`;

const FLAME = 'M0 50C-32 30 -22 -4 -4 -30C-8 -8 6 -4 8 -18C24 6 32 34 0 50Z';
const FLAME_IN = 'M0 42C-14 32 -10 14 -2 2C-2 14 6 16 8 8C14 20 14 34 0 42Z';

/**
 * Each colour's motif in a 200 × 200 box, as worked out in the prototypes
 * (#246). Each ends in a ring of small details, since the medallion ring
 * already frames it. None are Wizards of the Coast symbols.
 */
const DRAWINGS: Readonly<Record<MotifKey, () => MotifDrawing>> = {
  /** Sunburst of lens petals and thin rays round a double centre circle. */
  W() {
    const strokes: Stroke[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8 - Math.PI / 2;
      strokes.push([lens(28, 76, a, 0.2), 1]);
      const b = a + TAU / 16;
      strokes.push([`M${pt(polar(30, b))}L${pt(polar(58, b))}`, 0.75]);
    }
    strokes.push([circle(100, 100, 18), 1.1], [circle(100, 100, 9), 0.8]);
    return { strokes, dots: dotRing(16, 84, 1.9, TAU / 32) };
  },

  /** Triple spiral, ringed by wave crests. */
  U() {
    const strokes: Stroke[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3 - Math.PI / 2;
      const [cx, cy] = polar(24, a);
      const arm = spiral(cx, cy, 1.5, 22, 1.75, 1, a + Math.PI);
      strokes.push([`${arm}Q${pt(polar(20, a + TAU / 3))} 100 100`, 1.15]);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12;
      strokes.push([
        `M${pt(polar(76, a - 0.14))}Q${pt(polar(86, a - 0.03))} ${pt(polar(82, a + 0.07))}` +
          `Q${pt(polar(78, a + 0.1))} ${pt(polar(79, a + 0.03))}`,
        0.75,
      ]);
    }
    return { strokes, dots: [] };
  },

  /** Angular skull with slanted sockets and a cracked cranium, ringed by thorns. */
  B() {
    const strokes: Stroke[] = [];
    for (let k = 0; k < 14; k++) {
      const a = (k * TAU) / 14;
      strokes.push([
        `M${pt(polar(78, a - 0.07))}L${pt(polar(88, a + 0.015))}L${pt(polar(78, a + 0.07))}Z`,
        0.6,
      ]);
    }
    const skull = (d: string) => transform(d, 100, 100, 1.1, 100, 100);
    strokes.push(
      [
        skull(
          'M100 56C122 56 136 72 136 92C136 106 130 114 124 118L120 134C112 140 88 140 80 134' +
            'L76 118C70 114 64 106 64 92C64 72 78 56 100 56Z',
        ),
        1.25,
      ],
      [skull('M74 92Q88 88 96 100Q92 112 82 110Q74 104 74 92Z'), 1],
      [skull('M126 92Q112 88 104 100Q108 112 118 110Q126 104 126 92Z'), 1],
      [skull('M100 108L95 122Q100 119 105 122Z'), 0.75],
      [skull('M68 104Q72 116 84 122'), 0.7],
      [skull('M132 104Q128 116 116 122'), 0.7],
      [skull('M84 130Q100 136 116 130'), 0.85],
      [skull('M112 58L106 68L112 74L107 84'), 0.6],
    );
    return { strokes, dots: [] };
  },

  /** A large flame with inner fire, two small side flames and embers, ringed by flicks. */
  R() {
    const strokes: Stroke[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12 + TAU / 24;
      strokes.push([lens(74, k % 2 ? 84 : 89, a, 0.07, 0.05), 0.6]);
    }
    strokes.push(
      [transform(FLAME, 100, 84, 1.3), 1.15],
      [transform(FLAME_IN, 100, 84, 1.3), 0.85],
      [transform(FLAME, 62, 124, 0.5), 0.75],
      [transform(FLAME, 138, 124, 0.5), 0.75],
    );
    return {
      strokes,
      dots: [
        [66, 62, 2],
        [136, 56, 1.6],
        [146, 86, 1.3],
        [54, 90, 1.4],
      ],
    };
  },

  /** A tree: two-line trunk into two roots, three branches, a three-lobed canopy. */
  G() {
    const strokes: Stroke[] = [
      [
        'M74 104C56 104 52 80 68 72C66 52 88 44 100 52C112 44 134 52 132 72C148 80 144 104 126 104' +
          'C114 108 86 108 74 104Z',
        1.1,
      ],
      ['M95 106C96 122 94 136 86 150', 1.25],
      ['M105 106C104 122 106 136 114 150', 1.25],
      ['M86 150C80 155 74 157 68 157', 0.8],
      ['M114 150C120 155 126 157 132 157', 0.8],
      ['M98 104C92 96 86 90 80 84', 0.7],
      ['M102 104C108 96 114 90 120 84', 0.7],
      ['M100 104C100 94 100 84 100 70', 0.7],
    ];
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10 + TAU / 20;
      strokes.push([lens(76, 88, a, 0.09, k % 2 ? 0.06 : -0.06), 0.55]);
    }
    return {
      strokes,
      dots: [
        [76, 84, 2],
        [88, 64, 1.8],
        [112, 62, 2],
        [124, 84, 1.8],
        [100, 58, 1.4],
        [84, 96, 1.5],
        [118, 96, 1.5],
        [70, 94, 1.3],
        [132, 92, 1.3],
      ],
    };
  },

  /** A faceted gem, ringed by small diamonds. */
  C() {
    const strokes: Stroke[] = [
      [rhombus(100, 100, 34, 54), 1.2],
      [rhombus(100, 100, 15, 24), 0.9],
      ['M100 46L100 76', 0.6],
      ['M134 100L115 100', 0.6],
      ['M100 154L100 124', 0.6],
      ['M66 100L85 100', 0.6],
    ];
    for (let k = 0; k < 8; k++) {
      const [px, py] = polar(82, (k * TAU) / 8 + TAU / 16);
      strokes.push([rhombus(px, py, 3.5, 5.5), 0.5]);
    }
    return { strokes, dots: [[100, 100, 2.2]] };
  },

  /** The blank slot: a small gem, ringed by dots. */
  N() {
    return {
      strokes: [
        [rhombus(100, 100, 10, 15), 0.9],
        [rhombus(100, 100, 4, 6), 0.5],
      ],
      dots: dotRing(16, 84, 1.6, TAU / 32),
    };
  },
};

/** The brush width at weight 1, in motif units. */
const BRUSH = 2.7;

const bodies = new Map<MotifKey, string>();

/**
 * A motif's brushed SVG, as paths and circles without a fill, for a `<g>` to
 * colour. Brushing samples every path, so each motif is drawn once and kept.
 */
export function motifBody(key: MotifKey): string {
  let body = bodies.get(key);
  if (body === undefined) {
    const { strokes, dots } = DRAWINGS[key]();
    const phase = key.charCodeAt(0);
    body =
      strokes
        .map(
          ([d, w], i) =>
            `<path fill-rule='evenodd' d='${brush(d, BRUSH * w, i * 1.37 + phase)}'/>`,
        )
        .join('') +
      dots
        .map(
          ([cx, cy, r]) => `<circle cx='${fmt(cx)}' cy='${fmt(cy)}' r='${r}'/>`,
        )
        .join('');
    bodies.set(key, body);
  }
  return body;
}
