import { expect, test, type Page } from '@playwright/test';

// #229, #230: a palette opened while another window is still closing must stay
// open. Both races live in the close transitions, so let them run.
test.use({ reducedMotion: 'no-preference' });

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/focus.jpg';
const card = {
  object: 'card',
  id: 'e2e-focus-card',
  name: 'Focus Test Ooze',
  mana_cost: '{1}{G}',
  type_line: 'Creature — Ooze',
  scryfall_uri: 'https://scryfall.com/card/e2e/2/focus-test-ooze',
  image_status: 'highres_scan',
  image_uris: { border_crop: IMAGE_URL, normal: IMAGE_URL, small: IMAGE_URL },
};
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.route('https://api.scryfall.com/**', (route) =>
    new URL(route.request().url()).pathname === '/cards/random'
      ? route.fulfill({ json: card })
      : route.fulfill({ status: 404, json: { object: 'error' } }),
  );
  await page.route('https://cards.scryfall.io/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await page.goto('/');
});

const paletteOption = (page: Page) =>
  page.getByRole('option', { name: /Add card/i });

/** Checks the palette is still open once every close transition is over. */
async function expectPaletteStaysOpen(page: Page) {
  await expect(paletteOption(page)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(paletteOption(page)).toBeVisible();
}

test('a palette opened while On-deck closes after a cast stays open (#229)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await page.keyboard.press('/');

  await expectPaletteStaysOpen(page);
});

test('/ reopens the palette straight after Escape and a click on the board (#230)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();

  await page.keyboard.press('/');
  await expect(paletteOption(page)).toBeVisible();
  await page.keyboard.press('Escape');
  // A press on the board doesn't take focus, and the palette is still closing.
  await page.mouse.click(40, 700);
  await page.keyboard.press('/');

  await expectPaletteStaysOpen(page);
});
