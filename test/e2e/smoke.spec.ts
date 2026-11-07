import { expect, test, type Page } from '@playwright/test';

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/test-card.jpg';

const card = {
  object: 'card',
  id: 'e2e-test-card',
  name: 'Smoke Test Ooze',
  mana_cost: '{1}{G}',
  type_line: 'Creature — Ooze',
  scryfall_uri: 'https://scryfall.com/card/e2e/1/smoke-test-ooze',
  image_status: 'highres_scan',
  image_uris: { border_crop: IMAGE_URL, normal: IMAGE_URL, small: IMAGE_URL },
};

// A 1x1 transparent PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** Answers every Scryfall request locally, so tests never hit the network. */
async function mockScryfall(page: Page) {
  await page.route('https://api.scryfall.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/cards/random') return route.fulfill({ json: card });
    if (url.pathname === '/cards/search') {
      // Like Scryfall: 400 for an empty query, 404 for no matches.
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      if (!q) return route.fulfill({ status: 400, json: { object: 'error' } });
      if (!card.name.toLowerCase().includes(q))
        return route.fulfill({ status: 404, json: { object: 'error' } });
      return route.fulfill({ json: { object: 'list', data: [card] } });
    }
    return route.fulfill({ status: 404, json: { object: 'error' } });
  });
  await page.route('https://cards.scryfall.io/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockScryfall(page);
  await page.goto('/');
});

test('the app loads', async ({ page }) => {
  await expect(page).toHaveTitle('MTG Harmony');
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeVisible();
});

test('/ opens the command palette', async ({ page }) => {
  await page.keyboard.press('/');

  await expect(page.getByRole('option', { name: /Add card/i })).toBeVisible();
});

test('a card fetched On-deck can be cast to the board', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByRole('img', { name: card.name })).toBeVisible();

  await page.getByRole('button', { name: 'Cast to board' }).click();

  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
});

// #23: both copies used to share one ID.
test('the same card cast twice gives two separate cards', async ({ page }) => {
  // The mocked random endpoint always returns the same card.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }

  const boardCards = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCards).toHaveCount(2);
});

// #25: saves are debounced, so leaving the page must write the last change.
test('a card cast just before a reload is still there', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await page.reload();

  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
});

// #28: Cancel only emitted an event, so the modal stayed open.
test('the stack remove button confirms before removing', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  const confirm = page.getByRole('dialog', { name: 'Confirm' });

  await boardCard.hover();
  await page.getByRole('button', { name: 'Remove card' }).click();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(boardCard).toBeVisible();

  await boardCard.hover();
  await page.getByRole('button', { name: 'Remove card' }).click();
  await confirm.getByRole('button', { name: 'Remove' }).click();
  await expect(confirm).toBeHidden();
  await expect(boardCard).toBeHidden();
});

test('a card found through Add Card goes on the board', async ({ page }) => {
  await page.keyboard.press('/');
  await page.getByRole('option', { name: /Add card/i }).click();
  const addCard = page.getByRole('dialog', { name: 'Add card' });
  await addCard.getByRole('textbox').fill('ooze');
  await addCard.getByRole('option').first().click();

  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
});

test('Add Card prompts before searching and says when nothing matches', async ({
  page,
}) => {
  const searches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/cards/search')
      searches.push(url.searchParams.get('q') ?? '');
  });

  await page.keyboard.press('/');
  await page.getByRole('option', { name: /Add card/i }).click();
  const addCard = page.getByRole('dialog', { name: 'Add card' });

  await expect(addCard.getByText('Type a card name')).toBeVisible();

  await addCard.getByRole('textbox').fill('nonexistent');
  await expect(addCard.getByText('No cards found.')).toBeVisible();
  expect(searches).toEqual(['nonexistent']);
});
