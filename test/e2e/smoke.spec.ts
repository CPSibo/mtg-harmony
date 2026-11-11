import { expect, test, type Page } from '@playwright/test';

const IMAGE_URL = 'https://cards.scryfall.io/border_crop/front/test-card.jpg';

const card = {
  object: 'card',
  id: 'e2e-test-card',
  name: 'Smoke Test Ooze',
  mana_cost: '{1}{G}',
  type_line: 'Creature — Ooze',
  power: '2',
  toughness: '2',
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

// #78: every cast card used to land on the same spot.
test('cards cast in a row sit side by side in view', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
    await expect(page.locator('.board-card-stack')).toHaveCount(i + 1);
  }
  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

  const viewport = page.viewportSize()!;
  const boxes = await page
    .locator('.board-card-stack .primary-card')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
  for (const [i, a] of boxes.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(viewport.width);
    expect(a.y + a.height).toBeLessThanOrEqual(viewport.height);
    for (const b of boxes.slice(i + 1)) {
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart).toBe(true);
    }
  }
});

// #79
test.describe('dragging the On-deck card', () => {
  async function dragCard(page: Page, to: { x: number; y: number }) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    const image = page
      .getByRole('dialog', { name: 'On-deck' })
      .getByRole('img', { name: card.name });
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x - 50, to.y, { steps: 5 });
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
  }

  test('casts it where it is dropped on the board', async ({ page }) => {
    const drop = { x: 1000, y: 400 };

    await dragCard(page, drop);

    const placed = page.locator('.board-card-stack .primary-card');
    await expect(placed).toHaveCount(1);
    const box = (await placed.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - drop.x)).toBeLessThan(15);
    expect(Math.abs(box.y + box.height / 2 - drop.y)).toBeLessThan(15);
  });

  test('cancels when dropped back on the panel', async ({ page }) => {
    await dragCard(page, { x: 150, y: 600 });

    await expect(
      page.getByRole('dialog', { name: 'On-deck' }).getByRole('img', {
        name: card.name,
      }),
    ).toBeVisible();
    await expect(page.locator('.board-card-stack')).toHaveCount(0);
  });
});

// #42
test('with card images off, cards show as text and no image loads', async ({
  page,
}) => {
  // Reload first, so pending saves land before the settings are replaced.
  await page.reload();
  await page.evaluate(() =>
    // devalue's format for { imagesEnabled: false }
    localStorage.setItem(
      'mtg-harmony_settings',
      JSON.stringify([{ imagesEnabled: 1 }, false]),
    ),
  );
  const images: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('https://cards.scryfall.io/')) images.push(r.url());
  });
  await page.reload();

  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toContainText(card.name);
  await expect(boardCard).toContainText('Creature — Ooze');
  await expect(boardCard).toContainText('2/2');
  await expect(boardCard.locator('.ms-g')).toBeVisible();
  expect(images).toEqual([]);
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
  await expect(addCard).toBeHidden();
  await expect(page.getByRole('option', { name: /Add card/i })).toBeHidden();
});

test.describe('dragging an Add Card result', () => {
  async function dragResult(page: Page, to: { x: number; y: number }) {
    await page.keyboard.press('/');
    await page.getByRole('option', { name: /Add card/i }).click();
    const addCard = page.getByRole('dialog', { name: 'Add card' });
    await addCard.getByRole('textbox').fill('ooze');
    const result = addCard.getByRole('img', { name: card.name }).first();
    const box = (await result.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x - 50, to.y, { steps: 5 });
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    return addCard;
  }

  test('casts it once, where it is dropped on the board', async ({ page }) => {
    const drop = { x: 1000, y: 550 };

    const addCard = await dragResult(page, drop);

    // One card: the click after the drag must not cast it again.
    const placed = page.locator('.board-card-stack .primary-card');
    await expect(placed).toHaveCount(1);
    const box = (await placed.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - drop.x)).toBeLessThan(15);
    expect(Math.abs(box.y + box.height / 2 - drop.y)).toBeLessThan(15);
    await expect(addCard).toBeHidden();
    // The root palette closes too, as it does after a tap.
    await expect(page.getByRole('option', { name: /Add card/i })).toBeHidden();
  });

  test('cancels when dropped back on the window', async ({ page }) => {
    const addCard = await dragResult(page, { x: 640, y: 60 });

    await expect(addCard).toBeVisible();
    await expect(page.locator('.board-card-stack')).toHaveCount(0);
  });
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

// #127: a tapped attachment slid right instead of staying centred.
test('a tapped attachment stays centred on the stack', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const stacks = page.locator('.board-card-stack');
  const details = page.getByRole('dialog', { name: 'Card details' });
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
  await details.getByRole('button', { name: 'Attach to...' }).click();
  await stacks.nth(0).locator('.primary-card').getByRole('img').click();
  await expect(stacks).toHaveCount(1);

  const primary = stacks.first().locator('.primary-card');
  const attachment = stacks.first().locator('.attachment');
  const centre = async (locator: typeof primary) => {
    const b = (await locator.boundingBox())!;
    return b.x + b.width / 2;
  };
  // Tapping eases (#124): wait until a card lies on its side.
  const sideways = (locator: typeof primary) =>
    expect
      .poll(async () => {
        const b = (await locator.boundingBox())!;
        return b.width > b.height;
      })
      .toBe(true);

  // The primary covers the attachment's top; open it from its bottom edge.
  const attached = (await attachment.getByRole('img').boundingBox())!;
  await attachment.getByRole('img').dblclick({
    position: { x: attached.width / 2, y: attached.height - 5 },
  });
  await details.getByRole('button', { name: 'Tap' }).click();
  await expect(attachment).toHaveClass(/tapped/);
  await sideways(attachment);
  await expect
    .poll(
      async () =>
        Math.round((await centre(attachment)) - (await centre(primary))),
      { timeout: 5000 },
    )
    .toBe(0);

  // Still centred once the primary taps too.
  await primary.getByRole('img').dblclick({ position: { x: 10, y: 5 } });
  await details.getByRole('button', { name: 'Tap' }).click();
  await expect(primary).toHaveClass(/tapped/);
  await sideways(primary);
  await expect
    .poll(
      async () =>
        Math.round((await centre(attachment)) - (await centre(primary))),
      { timeout: 5000 },
    )
    .toBe(0);
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
/** Makes the event log's last event 3 hours old, then reloads. */
async function ageTheLog(page: Page) {
  // Reload first, so pending saves land before the log is replaced.
  await page.reload();
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
}

test.describe('after 2 hours idle', () => {
  test('does not ask with nothing on the board', async ({ page }) => {
    await ageTheLog(page);

    await expect(page.getByRole('button', { name: 'On-deck' })).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Start a new game?' }),
    ).toBeHidden();
  });

  test.describe('with cards on the board', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: 'On-deck' }).click();
      await page.getByRole('button', { name: 'Next card' }).click();
      await page.getByRole('button', { name: 'Cast to board' }).click();
      await ageTheLog(page);
    });

    test('offers a new game that clears the session', async ({ page }) => {
      const prompt = page.getByRole('dialog', { name: 'Start a new game?' });
      await expect(prompt).toBeVisible();

      await prompt.getByRole('button', { name: 'New game' }).click();

      await expect(prompt).toBeHidden();
      await expect(page.locator('.board-card')).toHaveCount(0);
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
});

// #40
test.describe('exporting the log', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('downloads CSV and copies a plain list of the cards cast', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Event log' }).click();
    await page
      .getByRole('dialog', { name: 'Event log' })
      .getByRole('button', { name: 'Export' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Export log' });
    await expect(dialog.getByText('Matches 1 card')).toBeVisible();
    await dialog.getByRole('button', { name: 'All events' }).click();
    await expect(dialog.getByText(/^Matches \d+ events$/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cards cast' }).click();

    await dialog.getByRole('button', { name: 'CSV' }).click();
    await expect(dialog.getByRole('button', { name: 'CSV' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(
      /^mtg-harmony-cast-game-.*\.csv$/,
    );
    const { readFile } = await import('node:fs/promises');
    const csv = await readFile((await download.path())!, 'utf8');
    expect(csv).toContain('time,event,card,details,scryfall_url,game');
    expect(csv).toContain(`,cast,${card.name},,${card.scryfall_uri},`);

    await dialog.getByRole('button', { name: 'Plain text' }).click();
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
    const copied = await page.evaluate('navigator.clipboard.readText()');
    // Windows' clipboard turns \n into \r\n.
    expect(copied).toMatch(/^\d\d:\d\d {2}Cast {2}Smoke Test Ooze\r?\n$/);
  });
});

test('with card outlines off, board cards have no visible border', async ({
  page,
}) => {
  await page.reload();
  await page.evaluate(() =>
    // devalue's format for { cardOutlineEnabled: false }
    localStorage.setItem(
      'mtg-harmony_settings',
      JSON.stringify([{ cardOutlineEnabled: 1 }, false]),
    ),
  );
  await page.reload();

  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();

  const wrapper = page.locator('.board-card .card-image-wrapper');
  await wrapper.hover();
  await expect(wrapper).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
});

// #81: past games live in IndexedDB, the current game in localStorage.
test('the log keeps the last game after a new game and a reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.board-card')).toHaveCount(0);
  await page.reload();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Event log' }).click();
  const events = page
    .getByRole('dialog', { name: 'Event log' })
    .getByRole('list', { name: 'Events' });
  await expect(events.getByText('New game (from the menu)')).toBeVisible();
  await expect(events.getByText(`Cast ${card.name}`)).toBeVisible();
});
