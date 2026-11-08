import { describe, expect, it } from 'vitest';
// @ts-expect-error The script is plain JS with no types.
import { neededIcons } from '../../../scripts/icons/lucide.mjs';
import lucide from '~/assets/icons/lucide.json';

// #100: icons ship in the bundle, so none is fetched from the Iconify API.
describe('bundled Lucide icons', () => {
  it('include every icon the app and Nuxt UI use', () => {
    const bundled = new Set([
      ...Object.keys(lucide.icons),
      ...Object.keys(lucide.aliases ?? {}),
    ]);

    const missing = [...(neededIcons() as Set<string>)].filter(
      (name) => !bundled.has(name),
    );

    expect(missing, 'run `npm run icons:lucide`').toEqual([]);
  });
});
