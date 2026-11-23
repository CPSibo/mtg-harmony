import { describe, expect, it } from 'vitest';
import { APP_VERSION, formatVersion } from '~/utils/appVersion';

describe('formatVersion', () => {
  it('names the version and the commit it was built from (#168)', () => {
    expect(formatVersion('1.0.0', 'abc1234')).toBe('v1.0.0 (abc1234)');
  });

  it('leaves the commit out when the build had none', () => {
    expect(formatVersion('1.0.0', '')).toBe('v1.0.0');
  });
});

describe('APP_VERSION', () => {
  it('is the version from package.json, set at build time', async () => {
    const { version } = (await import('../../../package.json')).default;
    expect(APP_VERSION.startsWith(`v${version}`)).toBe(true);
  });
});
