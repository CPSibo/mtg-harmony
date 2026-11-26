import { expect, test, type Page } from '@playwright/test';

// #244: a context menu on empty board space.

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/menu-card.jpg';
const card = {
  object: 'card',
  id: 'e2e-menu-card',
  name: 'Menu Test Ooze',
  mana_cost: '{1}{G}',
  type_line: 'Creature — Ooze',
  power: '2',
  toughness: '2',
  scryfall_uri: 'https://scryfall.com/card/e2e/2/menu-test-ooze',
  image_status: 'highres_scan',
  image_uris: { border_crop: IMAGE_URL, normal: IMAGE_URL, small: IMAGE_URL },
};
// A 1x1 transparent PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.route('https://api.scryfall.com/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/cards/random') return route.fulfill({ json: card });
    if (pathname === '/cards/search')
      return route.fulfill({ json: { object: 'list', data: [card] } });
    return route.fulfill({ status: 404, json: { object: 'error' } });
  });
  await page.route('https://cards.scryfall.io/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await page.goto('/');
});

const menu = (page: Page) => page.getByRole('menu');
const item = (page: Page, name: string) =>
  // Anchored: 'Select all' is in 'Deselect all', and shortcuts follow names.
  page.getByRole('menuitem', { name: new RegExp(`^${name}`) });
const stacks = (page: Page) => page.locator('.board-card-stack');

/** Fetches a card On-deck and closes the panel, leaving it there to cast. */
async function fetchOnDeck(page: Page) {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByRole('img', { name: card.name })).toBeVisible();
  // The panel doesn't close on Esc; its shortcut toggles it.
  await page.keyboard.press('o');
  await page.keyboard.press('o');
  await expect(page.getByRole('dialog', { name: 'On-deck' })).toBeHidden();
}

async function castOne(page: Page) {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await expect(stacks(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();
}

test('a right-click on empty board opens the menu, and casts On-deck there', async ({
  page,
}) => {
  await fetchOnDeck(page);
  const at = { x: 900, y: 420 };

  await page.mouse.click(at.x, at.y, { button: 'right' });

  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveText([
    /Cast On-deck card here/,
    /Add card here…/,
    // Arrange and Zoom to fit need a card on the board.
    /Reset view/,
  ]);

  await item(page, 'Cast On-deck card here').click();
  await expect(menu(page)).toBeHidden();
  const placed = page.locator('.board-card-stack .primary-card');
  await expect(placed).toHaveCount(1);
  const box = (await placed.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - at.x)).toBeLessThan(15);
  expect(Math.abs(box.y + box.height / 2 - at.y)).toBeLessThan(15);
});

// The browser's own menu would open over ours. On Windows its `contextmenu`
// comes after the button is up, when ours is open and the board under the
// pointer no longer takes pointer events.
test("a right-click opens no browser menu over the board's", async ({
  page,
}) => {
  // A string: the tests' types have no DOM. Added last of all, so it sees
  // whether anything cancelled the browser's event.
  await page.evaluate(`
    window.seen = [];
    window.addEventListener('contextmenu', (e) => {
      if (e.isTrusted) window.seen.push(e.defaultPrevented);
    });
  `);

  await page.mouse.click(900, 420, { button: 'right' });
  await expect(menu(page)).toBeVisible();

  const seen = await page.evaluate<boolean[]>('window.seen');
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every(Boolean)).toBe(true);
});

test('Select all turns into Deselect all', async ({ page }) => {
  await castOne(page);

  await page.mouse.click(900, 600, { button: 'right' });
  await item(page, 'Select all').click();
  await expect(page.locator('.board-card-stack.selected')).toHaveCount(1);
  await expect(menu(page)).toBeHidden();

  await page.mouse.click(900, 600, { button: 'right' });
  await expect(item(page, 'Select all')).toHaveCount(0);
  await item(page, 'Deselect all').click();
  await expect(page.locator('.board-card-stack.selected')).toHaveCount(0);
});

test('Add card here puts the card found where the menu opened', async ({
  page,
}) => {
  const at = { x: 950, y: 500 };
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await item(page, 'Add card here…').click();
  const addCard = page.getByRole('dialog', { name: 'Add card' });
  await addCard.getByRole('textbox').fill('ooze');
  await addCard.getByRole('option').first().click();
  await expect(addCard).toBeHidden();

  const placed = page.locator('.board-card-stack .primary-card');
  await expect(placed).toHaveCount(1);
  const box = (await placed.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - at.x)).toBeLessThan(15);
  expect(Math.abs(box.y + box.height / 2 - at.y)).toBeLessThan(15);
});

test('a right-drag pans and opens nothing', async ({ page }) => {
  await castOne(page);
  const placed = page.locator('.board-card-stack .primary-card');
  const before = (await placed.boundingBox())!;

  await page.mouse.move(900, 600);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(800, 550, { steps: 5 });
  await page.mouse.up({ button: 'right' });

  await expect(menu(page)).toBeHidden();
  const after = (await placed.boundingBox())!;
  expect(after.x).toBeLessThan(before.x - 50);
});

test('a right-click on a card opens no board menu', async ({ page }) => {
  await castOne(page);

  await page
    .locator('.board-card-stack .primary-card')
    .click({ button: 'right' });

  await expect(menu(page)).toBeHidden();
});

test('the Menu key opens it, with focus on the board', async ({ page }) => {
  await page.keyboard.press('ContextMenu');
  await expect(menu(page)).toBeVisible();
  await expect(item(page, 'Reset view')).toBeVisible();
});

test.describe('on touch', () => {
  test.use({ hasTouch: true });

  /** Holds one finger still at a point for `ms`, then lifts it. */
  async function hold(page: Page, at: { x: number; y: number }, ms: number) {
    const cdp = await page.context().newCDPSession(page);
    const point = { x: at.x, y: at.y, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }

  test('a long press on empty board opens the menu, and a tap does not', async ({
    page,
  }) => {
    await hold(page, { x: 900, y: 420 }, 100);
    await expect(menu(page)).toBeHidden();

    await hold(page, { x: 900, y: 420 }, 800);
    await expect(menu(page)).toBeVisible();
  });

  test('a long press opens nothing in selection mode', async ({ page }) => {
    await castOne(page);
    const mode = page.getByRole('button', {
      name: /^(Select stacks|Leave selection mode)/,
    });
    await mode.click();
    await expect(mode).toHaveAttribute('aria-pressed', 'true');

    await hold(page, { x: 900, y: 600 }, 800);
    await expect(menu(page)).toBeHidden();
  });
});
