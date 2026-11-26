import { describe, expect, it } from 'vitest';
import { normalizeBoardColors } from '~/features/boardBackground/colors';

describe('normalizeBoardColors', () => {
  it('keeps valid colours once each, in WUBRGC order', () => {
    expect(normalizeBoardColors(['C', 'G', 'x', 'W', 'G', 3])).toEqual([
      'W',
      'G',
      'C',
    ]);
  });
});
