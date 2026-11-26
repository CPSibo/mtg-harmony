import { describe, expect, it } from 'vitest';
import {
  brush,
  circle,
  flatten,
  pathLength,
  resample,
  transform,
} from '~/features/boardBackground/geometry';

const subpaths = (d: string) => d.match(/M/g)?.length ?? 0;
const numbers = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe('flatten', () => {
  it('follows lines', () => {
    expect(flatten('M0 0L10 0L10 10')).toEqual({
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      closed: false,
    });
  });

  it('closes a path back to its start', () => {
    const { points, closed } = flatten('M0 0L10 0L10 10Z');
    expect(closed).toBe(true);
    expect(points.at(-1)).toEqual([0, 0]);
  });

  it('ends curves on their end points', () => {
    expect(flatten('M0 0Q5 10 10 0').points.at(-1)).toEqual([10, 0]);
    expect(flatten('M0 0C0 10 10 10 10 0').points.at(-1)).toEqual([10, 0]);
  });

  it('measures a circle close to 2πr', () => {
    expect(pathLength(flatten(circle(0, 0, 10)).points)).toBeCloseTo(
      2 * Math.PI * 10,
      0,
    );
  });
});

describe('resample', () => {
  it('spaces points evenly along the path', () => {
    const p = resample(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      4,
    );
    expect(p).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 5],
      [10, 10],
    ]);
  });
});

describe('transform', () => {
  it('scales about a centre and moves', () => {
    expect(transform('M10 20L30 40', 100, 100, 2, 10, 20)).toBe(
      'M100.0 100.0L140.0 140.0',
    );
  });
});

describe('brush', () => {
  it('outlines an open stroke as one closed shape', () => {
    const d = brush('M0 0L100 0', 4, 0);
    expect(subpaths(d)).toBe(1);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('tapers an open stroke towards its ends', () => {
    const d = brush('M0 0L100 0', 4, 0);
    const n = numbers(d);
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    const widthAt = (x: number) => {
      const near = ys.filter((_, i) => Math.abs(xs[i]! - x) < 2.5);
      return Math.max(...near) - Math.min(...near);
    };
    expect(widthAt(0)).toBeLessThan(widthAt(50) / 2);
    expect(widthAt(50)).toBeGreaterThan(3);
  });

  it('outlines a closed loop as an outer and inner loop', () => {
    expect(subpaths(brush(circle(50, 50, 20), 3, 0))).toBe(2);
  });

  it('draws nothing for an empty path', () => {
    expect(brush('M5 5L5 5', 3, 0)).toBe('');
  });
});
