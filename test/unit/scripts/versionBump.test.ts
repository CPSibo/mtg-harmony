import { describe, expect, it } from 'vitest';
import { checkBump } from '../../../scripts/version/bump.mjs';

describe('checkBump', () => {
  it.each([
    ['0.9.0', '0.9.1'],
    ['0.9.3', '0.10.0'],
    ['0.9.3', '1.0.0'],
    ['1.2.3', '2.0.0'],
  ])('accepts one bump from %s to %s', (base, head) => {
    expect(checkBump(base, head)).toBeNull();
  });

  it('rejects an unchanged version, as when two branches made the same bump', () => {
    expect(checkBump('0.9.1', '0.9.1')).toMatch(
      /same as the base branch's 0\.9\.1/,
    );
  });

  it.each([
    ['0.9.0', '0.8.9'],
    ['0.9.0', '0.9.2'],
    ['0.9.3', '0.10.1'],
    ['0.9.3', '0.11.0'],
    ['0.9.3', '1.0.1'],
  ])(
    'rejects %s to %s, which is not one patch, minor or major bump',
    (base, head) => {
      expect(checkBump(base, head)).toMatch(/0\.9\.1|0\.10\.0|1\.0\.0/);
    },
  );

  it('rejects a version that is not x.y.z', () => {
    expect(checkBump('0.9.0', '0.9.1-beta')).toMatch(/not x\.y\.z/);
  });
});
