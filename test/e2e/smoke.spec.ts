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

// #58: iOS Safari's own gestures. Chromium can't reproduce them, but it does
// report the CSS that blocks them.
test('the page opts out of browser zoom, bounce and selection', async ({
  page,
}) => {
  const html = page.locator('html');
  await expect(html).toHaveCSS('overscroll-behavior-y', 'none');
  await expect(html).toHaveCSS('touch-action', 'manipulation');
  await expect(page.locator('.board')).toHaveCSS('user-select', 'none');
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

// #59: installable from the home screen, so iOS edge swipes can't navigate away.
test('the app is installable with its icons', async ({ page, request }) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: 'MTG Harmony',
    display: 'standalone',
    start_url: '/',
  });
  const icons: { src: string; sizes: string; purpose?: string }[] =
    manifest.icons;
  expect(icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);

  const touchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href');
  for (const src of [...icons.map((i) => i.src), touchIcon!]) {
    const response = await request.get(src);
    expect(response.ok(), src).toBe(true);
    expect(response.headers()['content-type']).toBe('image/png');
  }
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

// #33: the copy menu had no handlers.
test('copying a card puts a second one on the board', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCards = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });

  await boardCards.first().hover();
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy everything' }).click();

  await expect(boardCards).toHaveCount(2);
});

// #34: unders had no UI.
test('a card can be put under another and taken out again', async ({
  page,
}) => {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const stacks = page.locator('.board-card-stack');
  const unders = page.locator('.under');
  const details = page.getByRole('dialog', { name: 'Card details' });
  // Both cast to the board centre: move the front one aside first.
  await expect(stacks).toHaveCount(2);
  const front = stacks.nth(1).locator('.primary-card').getByRole('img');
  const box = (await front.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 3, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();

  await stacks.nth(1).locator('.primary-card').getByRole('img').dblclick();
  await details.getByRole('button', { name: 'Put under...' }).click();
  await stacks.nth(0).locator('.primary-card').getByRole('img').click();

  await expect(stacks).toHaveCount(1);
  await expect(unders).toHaveCount(1);

  // A tapped primary is wider; the under stays centred on it.
  const primary = stacks.first().locator('.primary-card');
  await primary.getByRole('img').dblclick();
  await details.getByRole('button', { name: 'Tap' }).click();
  await expect(primary).toHaveClass(/tapped/);
  const centre = async (locator: typeof primary) => {
    const b = (await locator.boundingBox())!;
    return b.x + b.width / 2;
  };
  expect(await centre(unders.first())).toBeCloseTo(await centre(primary), 0);

  await unders.getByRole('img').dblclick({ position: { x: 10, y: 5 } });
  await details.getByRole('button', { name: 'Take out' }).click();

  await expect(stacks).toHaveCount(2);
  await expect(unders).toHaveCount(0);
});

// #37
test('the event log lists what happened and can cast a fetched card again', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await page.keyboard.press('Escape');
  // The palette closes again if the panel is still handing back focus.
  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

  await page.keyboard.press('/');
  await page.getByRole('option', { name: /Open event log/i }).click();
  const log = page.getByRole('dialog', { name: 'Event log' });
  const events = log
    .getByRole('list', { name: 'Events' })
    .getByRole('listitem');

  await expect(events).toHaveText([
    new RegExp(`Cast ${card.name}`),
    new RegExp(`Fetched ${card.name}`),
  ]);

  await log
    .getByRole('textbox', { name: 'Filter by card name' })
    .fill('nothing like it');
  await expect(log.getByText('No events match.')).toBeVisible();
  await log.getByRole('textbox', { name: 'Filter by card name' }).fill('');

  await log.getByRole('button', { name: `Cast ${card.name}` }).click();
  await expect(events).toHaveCount(3);
  await expect(events.first()).toHaveText(new RegExp(`Cast ${card.name}`));

  // The open dialog hides the board from the accessibility tree.
  await page.keyboard.press('Escape');
  await expect(log).toBeHidden();
  await expect(
    page.locator('.board-card').getByRole('img', { name: card.name }),
  ).toHaveCount(2);
});

// #38: On-deck history now comes from the event log.
test('Prev card goes back to a card On-deck showed, which can still be cast', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  const prev = page.getByRole('button', { name: 'Prev card' });
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(prev).toBeDisabled();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(prev).toBeEnabled();

  await prev.click();
  await expect(prev).toBeDisabled();
  await page.getByRole('button', { name: 'Cast to board' }).click();

  await expect(
    page.locator('.board-card').getByRole('img', { name: card.name }),
  ).toBeVisible();
});

// #39
test.describe('after 2 hours idle', () => {
  test.beforeEach(async ({ page }) => {
    // A log whose last event is 3 hours old, then reload so the app sees it.
    await page.evaluate(() => {
      const at = Date.now() - 3 * 60 * 60 * 1000;
      const entry = {
        id: 'e1',
        at,
        type: 'boardCleared',
        gameId: 'g1',
      };
      // devalue's format for { entries: [entry], gameId: 'g1' }
      localStorage.setItem(
        'mtg-harmony_eventLog',
        JSON.stringify([
          { entries: 1, gameId: 6 },
          [2],
          { id: 3, at: 4, type: 5, gameId: 6 },
          entry.id,
          entry.at,
          entry.type,
          entry.gameId,
        ]),
      );
    });
    await page.reload();
  });

  test('offers a new game that clears the session', async ({ page }) => {
    const prompt = page.getByRole('dialog', { name: 'Start a new game?' });
    await expect(prompt).toBeVisible();

    await prompt.getByRole('button', { name: 'New game' }).click();

    await expect(prompt).toBeHidden();
    await page.reload();
    await expect(prompt).toBeHidden();
  });

  test('can be dismissed and stays dismissed', async ({ page }) => {
    const prompt = page.getByRole('dialog', { name: 'Start a new game?' });
    await prompt.getByRole('button', { name: 'Keep playing' }).click();
    await expect(prompt).toBeHidden();

    await page.reload();
    await expect(page.getByRole('button', { name: 'On-deck' })).toBeVisible();
    await expect(prompt).toBeHidden();
  });
});
