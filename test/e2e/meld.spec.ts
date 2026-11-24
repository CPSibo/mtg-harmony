import { expect, test, type Page } from '@playwright/test';

// #143: two meld halves on the board meld into one card, and back.

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/meld.jpg';

const all_parts = [
  {
    object: 'related_card',
    id: 'bruna',
    component: 'meld_part',
    name: 'Bruna, the Fading Light',
  },
  {
    object: 'related_card',
    id: 'brisela',
    component: 'meld_result',
    name: 'Brisela, Voice of Nightmares',
  },
  {
    object: 'related_card',
    id: 'gisela',
    component: 'meld_part',
    name: 'Gisela, the Broken Blade',
  },
];

function meldCard(id: string, name: string) {
  return {
    object: 'card',
    id,
    name,
    mana_cost: '{5}{W}{W}',
    type_line: 'Legendary Creature — Angel Horror',
    layout: 'meld',
    all_parts,
    scryfall_uri: `https://scryfall.com/card/emn/${id}`,
    image_status: 'highres_scan',
    image_uris: { border_crop: IMAGE_URL, normal: IMAGE_URL, small: IMAGE_URL },
  };
}

const cards = [
  meldCard('bruna', 'Bruna, the Fading Light'),
  meldCard('gisela', 'Gisela, the Broken Blade'),
  meldCard('brisela', 'Brisela, Voice of Nightmares'),
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

test('two meld halves meld into one card and unmeld again', async ({
  page,
}) => {
  const details = page.getByRole('dialog', { name: 'Card details' });
  const meld = details.getByRole('button', { name: 'Meld' });

  await addCard(page, 'bruna');
  await boardCard(page, 'Bruna, the Fading Light').dblclick();
  // Not without the other half on the board.
  await expect(details).toBeVisible();
  await expect(meld).toBeHidden();
  await page.keyboard.press('Escape');

  await addCard(page, 'gisela');
  await boardCard(page, 'Bruna, the Fading Light').dblclick();
  await page.context().setOffline(true);
  await expect(meld).toBeDisabled();
  await page.context().setOffline(false);
  await meld.click();

  const brisela = boardCard(page, 'Brisela, Voice of Nightmares');
  await expect(brisela).toBeVisible();
  await expect(page.locator('.board-card-stack')).toHaveCount(1);

  await brisela.dblclick();
  await details.getByRole('button', { name: 'Unmeld' }).click();

  await expect(brisela).toBeHidden();
  await expect(boardCard(page, 'Bruna, the Fading Light')).toBeVisible();
  await expect(boardCard(page, 'Gisela, the Broken Blade')).toBeVisible();
});
