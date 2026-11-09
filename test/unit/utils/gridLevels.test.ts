import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CELL,
  GRID_FACTOR,
  MIN_GAP,
  gridLevels,
} from '~/utils/gridLevels';

describe('gridLevels', () => {
  it('uses the snap size as the finest cell when zoomed in', () => {
    const g = gridLevels(10, 4);
    expect(g.minor).toBe(10);
    expect(g.major).toBe(10 * GRID_FACTOR);
    expect(g.minorAlpha).toBe(1);
  });

  it('falls back to the default cell when snapping is off', () => {
    expect(gridLevels(0, 4).minor).toBe(DEFAULT_CELL);
  });

  it('never draws minor lines closer than the minimum gap', () => {
    for (const s of [0.05, 0.1, 0.2, 0.33, 0.5, 1, 2]) {
      const g = gridLevels(10, s);
      expect(g.minor * s).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
      expect(g.major).toBeCloseTo(g.minor * GRID_FACTOR);
    }
  });

  it('steps up a level as you zoom out', () => {
    expect(gridLevels(10, 0.1).minor).toBeGreaterThan(gridLevels(10, 1).minor);
  });

  it('fades the minor lines in as they spread apart', () => {
    const justAbove = gridLevels(10, (MIN_GAP * 1.01) / 10);
    const wider = gridLevels(10, (MIN_GAP * 3) / 10);
    expect(justAbove.minor).toBe(10);
    expect(justAbove.minorAlpha).toBeLessThan(0.1);
    expect(wider.minorAlpha).toBeGreaterThan(justAbove.minorAlpha);
  });

  it('is continuous when the level changes', () => {
    const edge = MIN_GAP / 10;
    const below = gridLevels(10, edge * 0.999);
    const above = gridLevels(10, edge * 1.001);
    // Below: the old major lines become minor at full strength.
    expect(below.minor).toBe(above.major);
    expect(below.minorAlpha).toBeGreaterThan(0.99);
    expect(above.minorAlpha).toBeLessThan(0.01);
  });
});
