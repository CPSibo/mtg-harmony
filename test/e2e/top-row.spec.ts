import { expect, test, type Page } from '@playwright/test';

/** The buttons along the top of the screen, search included. */
const TOP_ROW = [
  'On-deck',
  'Search commands',
  'Select stacks',
  'Undo',
  'Untap all',
  'Open menu',
];

async function boxes(page: Page) {
  return Promise.all(
    TOP_ROW.map(async (name) => {
      const box = await page
        .getByRole('button', { name, exact: true })
        .first()
        .boundingBox();
      expect(box, name).not.toBeNull();
      return { name, ...box! };
    }),
  );
}

test.beforeEach(async ({ page }) => {
  // Nothing here needs Scryfall; keep On-deck's prefetch off the network.
  await page.route('https://api.scryfall.com/**', (route) =>
    route.fulfill({ status: 404, json: { object: 'error' } }),
  );
});

// #240: on phones the row ran off the left edge and the centred search
// button covered Select and Undo.
for (const width of [320, 375, 414, 640, 1280]) {
  test(`the top row fits without overlaps at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();

    const row = await boxes(page);
    for (const b of row) {
      expect(b.x, `${b.name} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${b.name} ends on screen`).toBeLessThanOrEqual(
        width,
      );
    }
    for (const [i, a] of row.entries())
      for (const b of row.slice(i + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.name} and ${b.name} don't overlap`).toBe(true);
      }
  });
}
