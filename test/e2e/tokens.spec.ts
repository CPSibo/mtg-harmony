import { expect, test, type Page } from '@playwright/test';

// #203: a card's tokens can be created from its details.

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/token.jpg';
const images = { border_crop: IMAGE_URL, normal: IMAGE_URL, small: IMAGE_URL };

const related = (id: string, name: string, type_line: string) => ({
  object: 'related_card',
  id,
  component: 'token',
  name,
  type_line,
});
const OOZE = related('ooze', 'Ooze', 'Token Creature — Ooze');
const CLUE = related('clue', 'Clue', 'Token Artifact — Clue');

function card(id: string, name: string, extra: object) {
  return {
    object: 'card',
    id,
    name,
    mana_cost: '',
    scryfall_uri: `https://scryfall.com/card/t/${id}`,
    image_status: 'highres_scan',
    image_uris: images,
    ...extra,
  };
}

const cards = [
  card('slime', 'Mitotic Slime', {
    type_line: 'Creature — Ooze',
    all_parts: [OOZE],
  }),
  card('tracker', 'Tireless Tracker', {
    type_line: 'Creature — Human Scout',
    all_parts: [OOZE, CLUE],
  }),
  card('ooze', 'Ooze', {
    type_line: OOZE.type_line,
    power: '2',
    toughness: '2',
  }),
  card('clue', 'Clue', { type_line: CLUE.type_line }),
];

// A 1x1 transparent PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function mockScryfall(page: Page) {
  await page.route('https://api.scryfall.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/cards/search') {
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      const found = cards.filter((c) => c.name.toLowerCase().includes(q));
      if (!q || !found.length)
        return route.fulfill({ status: 404, json: { object: 'error' } });
      return route.fulfill({ json: { object: 'list', data: found } });
    }
    const byId = cards.find((c) => url.pathname === `/cards/${c.id}`);
    if (byId) return route.fulfill({ json: byId });
    return route.fulfill({ status: 404, json: { object: 'error' } });
  });
  await page.route('https://cards.scryfall.io/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
}

async function addCard(page: Page, search: string) {
  await page.keyboard.press('/');
  await page.getByRole('option', { name: /Add card/i }).click();
  const window = page.getByRole('dialog', { name: 'Add card' });
  await window.getByRole('textbox').fill(search);
  await window.getByRole('option').first().click();
  await expect(window).toBeHidden();
}

const boardCard = (page: Page, name: string) =>
  page.locator('.board-card').getByRole('img', { name });

test.beforeEach(async ({ page }) => {
  await mockScryfall(page);
  await page.goto('/');
});

test('a card with one token creates it from its details', async ({ page }) => {
  await addCard(page, 'slime');
  await boardCard(page, 'Mitotic Slime').dblclick();
  const details = page.getByRole('dialog', { name: 'Card details' });
  await details.getByRole('button', { name: 'Create Ooze' }).click();

  await expect(details).toBeHidden();
  await expect(boardCard(page, 'Ooze')).toBeVisible();
  await expect(page.locator('.board-card-stack')).toHaveCount(2);
});

test('a card with several tokens picks one to create', async ({ page }) => {
  await addCard(page, 'tracker');
  await boardCard(page, 'Tireless Tracker').dblclick();
  await page
    .getByRole('dialog', { name: 'Card details' })
    .getByRole('button', { name: 'Create token…' })
    .click();

  const picker = page.getByRole('dialog', { name: 'Create token' });
  await expect(picker.getByRole('button', { name: /^Ooze/ })).toContainText(
    '2/2',
  );
  await picker.getByRole('button', { name: /^Clue/ }).click();

  await expect(picker).toBeHidden();
  await expect(boardCard(page, 'Clue')).toBeVisible();
});
