import { expect, test, type Locator, type Page } from '@playwright/test';
import { searchText } from './scryfall';

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
      const q = searchText(url);
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

/**
 * Opens a board card's details from the keyboard (#170). Unlike a double
 * click, it doesn't depend on what covers the card or where it is on screen.
 */
async function openDetails(card: Locator) {
  await card.focus();
  await card.press('Enter');
  await expect(
    card.page().getByRole('dialog', { name: 'Card details' }),
  ).toBeVisible();
}

test('the app loads', async ({ page }) => {
  await expect(page).toHaveTitle('MTG Harmony');
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeVisible();
});

test('/ opens the command palette', async ({ page }) => {
  await page.keyboard.press('/');

  await expect(page.getByRole('option', { name: /Add card/i })).toBeVisible();
});

// #218: the app's actions are in the palette, with shortcuts for the frequent ones.
test('the palette fetches, casts and runs board commands', async ({ page }) => {
  // On-deck's commands show once they can run (#235), so wait for the one
  // wanted before clicking: the list may still be filling in.
  const run = async (name: string) => {
    await page.keyboard.press('/');
    const option = page.getByRole('option', { name });
    await expect(option).toBeVisible();
    await option.click();
  };

  await run('Next card');
  // Next card opens On-deck to show it (#237).
  await expect(
    page.getByRole('button', { name: 'Cast to board' }),
  ).toBeVisible();
  await run('Cast On-deck card to board');
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
  // It says what it did (#237).
  await expect(
    page.getByText(`Cast ${card.name} to the board`, { exact: true }),
  ).toBeVisible();

  await run('Turn selection mode on or off');
  await expect(page.getByRole('status')).toContainText('Selecting');

  await run('Clear board');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('shortcuts fetch, cast and zoom to fit', async ({ page }) => {
  const chord = async (a: string, b: string) => {
    await page.keyboard.press(a);
    await page.keyboard.press(b);
  };
  // Next card opens On-deck to show it (#237).
  await chord('o', 'n');
  await expect(page.getByRole('img', { name: card.name })).toBeVisible();
  await chord('o', 'c');
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();

  // Pan the card off-screen, then zoom to fit brings it back.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(-600, -400, { steps: 5 });
  await page.mouse.up();
  await expect(boardCard).not.toBeInViewport();
  await chord('z', 'f');
  await expect(boardCard).toBeInViewport();
});

// The board cancels touchstart to pan, which stops the click Reka waits for
// before dismissing on touch (#135).
test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap on the board closes the palette', async ({ page }) => {
    await page.keyboard.press('/');
    const option = page.getByRole('option', { name: /Add card/i });
    await expect(option).toBeVisible();

    await page.touchscreen.tap(640, 600);

    await expect(option).toBeHidden();
  });

  test('a tap on a card stack closes Add Card', async ({ page }) => {
    await page.keyboard.press('/');
    await page.getByRole('option', { name: /Add card/i }).click();
    const addCard = page.getByRole('dialog', { name: 'Add card' });
    await addCard.getByRole('textbox').fill('ooze');
    await addCard.getByRole('img', { name: card.name }).first().click();
    const stack = page.locator('.board-card-stack .primary-card');
    await expect(stack).toHaveCount(1);
    await expect(addCard).toBeVisible();

    const box = (await stack.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(addCard).toBeHidden();
  });
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

// #175: instants and sorceries are cast without staying on the board.
test('a card cast to the graveyard is logged and leaves no card on the board', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to graveyard' }).click();

  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();
  await expect(page.locator('.board-card')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Event log' }).click();
  const events = page
    .getByRole('dialog', { name: 'Event log' })
    .getByRole('list', { name: 'Events' });
  await expect(
    events.getByText(`Cast ${card.name} to the graveyard`),
  ).toBeVisible();
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

// #223: Smart arrange lines the cards up in rows in view.
test('Smart arrange lines cards up in a row in view', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const cards = page.locator('.board-card-stack .primary-card [role=img]');
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();

  await page.keyboard.press('/');
  await page.getByRole('option', { name: /^Smart arrange Creatures/ }).click();

  await expect(async () => {
    const boxes = await Promise.all(
      [0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!),
    );
    const tops = boxes.map((b) => Math.round(b.y));
    expect(new Set(tops).size).toBe(1);
    const lefts = boxes.map((b) => b.x).sort((a, b) => a - b);
    expect(lefts[1]! - lefts[0]!).toBeGreaterThan(boxes[0]!.width);
  }).toPass();
  for (let i = 0; i < 3; i++) await expect(cards.nth(i)).toBeInViewport();
});

// #235: Space, Space runs Smart arrange and zooms to fit, once the board has
// focus rather than a button.
test('Space, Space arranges the cards and zooms to fit', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const cards = page.locator('.board-card-stack .primary-card [role=img]');
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();

  // A press on the board takes focus off the On-deck button.
  await page.mouse.click(40, 700);
  await page.keyboard.press(' ');
  await page.keyboard.press(' ');

  await expect(async () => {
    const boxes = await Promise.all(
      [0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!),
    );
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
  }).toPass();
  for (let i = 0; i < 3; i++) await expect(cards.nth(i)).toBeInViewport();
});

// #235: with a selection, the palette leaves out what isn't about it.
test('the palette leaves out On-deck and Add card with a selection', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();

  await page.keyboard.press('/');
  await expect(page.getByRole('option', { name: /^Add card/ })).toBeVisible();
  await expect(
    page.getByRole('option', { name: /Invert selection/ }),
  ).toHaveCount(0);
  await page.getByRole('option', { name: /^Select all/ }).click();

  await page.keyboard.press('/');
  await expect(
    page.getByRole('option', { name: /Invert selection/ }),
  ).toBeVisible();
  await expect(page.getByRole('option', { name: /^Add card/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /^Next card/ })).toHaveCount(0);
});

// #219: find a card on the board by its text and bring it into view.
test('Find on board pans to a match and selects it', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();

  // Pan the card off-screen.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(-600, -400, { steps: 5 });
  await page.mouse.up();
  await expect(boardCard).not.toBeInViewport();

  await page.keyboard.press('/');
  await page.getByRole('option', { name: /Find on board/ }).click();
  const findBox = page.getByRole('search').getByRole('textbox');
  await expect(findBox).toBeFocused();

  await findBox.fill('zzz');
  await expect(page.getByRole('search')).toContainText('No matches');

  // The type line matches too.
  await findBox.fill('creature ooze');
  await expect(page.getByRole('search')).toContainText('1 of 1');
  await expect(boardCard).toBeInViewport();
  await expect(page.locator('.board-card-stack.selected')).toHaveCount(1);

  await findBox.press('Escape');
  await expect(page.getByRole('search')).toBeHidden();
});

// #237: a box drawn in selection mode ends it, whatever it caught.
test('selection mode ends after a box is drawn', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await expect(page.locator('.board-card-stack')).toHaveCount(1);
  // On-deck has finished closing once it hands focus back to its button.
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();

  const mode = page.getByRole('button', {
    name: /^(Select stacks|Leave selection mode)/,
  });
  for (const catches of [false, true]) {
    await mode.click();
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    // An empty corner first, then a box over the whole view.
    const [from, to] = catches
      ? [
          { x: 5, y: 90 },
          { x: 1270, y: 715 },
        ]
      : [
          { x: 5, y: 600 },
          { x: 60, y: 700 },
        ];
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await expect(mode).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.board-card-stack.selected')).toHaveCount(
      catches ? 1 : 0,
    );
  }
});

// #216: a plain tap selects one stack, the target of palette commands.
test.describe('selecting by tap', () => {
  test.beforeEach(async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'On-deck' }).click();
      await page.getByRole('button', { name: 'Next card' }).click();
      await page.getByRole('button', { name: 'Cast to board' }).click();
    }
    await expect(page.locator('.board-card-stack')).toHaveCount(2);
    // On-deck has finished closing once it hands focus back to its button,
    // so the Tab test starts from there.
    await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();
  });

  const stacks = (page: Page) => page.locator('.board-card-stack');
  const selected = (page: Page) => page.locator('.board-card-stack.selected');
  const cardIn = (stack: Locator) => stack.locator('.primary-card [role=img]');

  test('a click selects one stack, and the selection bar opens', async ({
    page,
  }) => {
    const bar = page.locator('.selection-bar[role="status"]');
    await expect(bar).toBeHidden();
    await cardIn(stacks(page).first()).click();
    await expect(selected(page)).toHaveCount(1);
    // Its actions, outside selection mode too (#237).
    await expect(bar).toContainText('(1)');
    await expect(
      bar.getByRole('button', { name: 'Tap', exact: true }),
    ).toBeVisible();

    // Another click moves the selection; a modified click adds to it.
    await cardIn(stacks(page).nth(1)).click();
    await expect(selected(page)).toHaveCount(1);
    await cardIn(stacks(page).first()).click({ modifiers: ['Control'] });
    await expect(selected(page)).toHaveCount(2);
    await expect(page.locator('.selection-bar')).toContainText('(2)');

    // A click on the empty board clears it.
    await page.mouse.click(40, 700);
    await expect(selected(page)).toHaveCount(0);
    await expect(bar).toBeHidden();
  });

  test('dragging a stack does not select it', async ({ page }) => {
    const box = (await cardIn(stacks(page).first()).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 100, { steps: 5 });
    await page.mouse.up();
    await expect(selected(page)).toHaveCount(0);
  });

  test('a double click opens the card and leaves nothing selected', async ({
    page,
  }) => {
    await cardIn(stacks(page).first()).dblclick();
    await expect(
      page.getByRole('dialog', { name: 'Card details' }),
    ).toBeVisible();
    await expect(selected(page)).toHaveCount(0);
  });

  test('Tab onto a card selects its stack', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(async () => {
      await page.keyboard.press('Tab');
      await expect(page.locator('.card-image:focus')).toHaveCount(1);
    }).toPass();
    await expect(selected(page)).toHaveCount(1);
  });

  test('the palette acts on the selected stack', async ({ page }) => {
    // Nothing selected: no Selection group.
    await page.keyboard.press('/');
    const addCard = page.getByRole('option', { name: /Add card/i });
    await expect(addCard).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'Clear selection' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(addCard).toBeHidden();

    await cardIn(stacks(page).first()).click();
    await page.keyboard.press('/');
    await page.getByRole('option', { name: 'Show card details' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Card details' }),
    ).toBeVisible();
  });
});

// #220: build a selection from the palette.
test('the palette selects all, inverts and selects by type', async ({
  page,
}) => {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const selected = page.locator('.board-card-stack.selected');
  await expect(page.locator('.board-card-stack')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();
  const run = async (name: string) => {
    await page.keyboard.press('/');
    await page.getByRole('option', { name }).click();
  };

  await run('Select all');
  await expect(selected).toHaveCount(2);
  await run('Invert selection');
  await expect(selected).toHaveCount(0);

  await run('Select by type…');
  const box = page.getByRole('search', { name: 'Select by type' });
  await box.getByRole('textbox').fill('goblin');
  await expect(box).toContainText('No matches');
  await box.getByRole('textbox').fill('creature ooze');
  await expect(box).toContainText('2 stacks');
  await expect(selected).toHaveCount(2);
  await box.getByRole('textbox').press('Enter');
  await expect(box).toBeHidden();
  await expect(selected).toHaveCount(2);
});

// #221: the selection bar taps, counts, copies and removes several cards.
test('the selection bar acts on every selected card', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const stacks = page.locator('.board-card-stack');
  await expect(stacks).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();
  const primaries = stacks.locator('.primary-card');
  await primaries.nth(0).getByRole('img').click();
  await primaries
    .nth(1)
    .getByRole('img')
    .click({ modifiers: ['Control'] });
  const bar = page.locator('.selection-bar');
  await expect(bar).toContainText('(2)');

  await bar.getByRole('button', { name: 'Tap', exact: true }).click();
  await expect(primaries.nth(0)).toHaveClass(/tapped/);
  await expect(primaries.nth(1)).toHaveClass(/tapped/);

  await bar.getByRole('button', { name: 'Counters and keywords…' }).click();
  const counters = page.getByRole('dialog', {
    name: 'Counters and keywords on 2 cards',
  });
  await counters.getByRole('button', { name: 'Add +1/+1' }).click();
  await expect(counters).toContainText('on 2 of 2');
  await counters.getByRole('button', { name: 'Done' }).click();
  await expect(counters).toBeHidden();

  await bar.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('menuitem', { name: 'Copy: card only' }).click();
  await expect(stacks).toHaveCount(4);

  await bar.getByRole('button', { name: 'Remove…' }).click();
  await page.getByRole('button', { name: 'Remove 2 cards' }).click();
  await expect(stacks).toHaveCount(2);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Event log' }).click();
  const events = page
    .getByRole('dialog', { name: 'Event log' })
    .getByRole('list', { name: 'Events' });
  await expect(events.getByText('Removed 2 cards')).toBeVisible();
  await expect(events.getByText('Copied 2 cards (card only)')).toBeVisible();
});

// #222: the selection bar's "More…" menu arranges and attaches several cards.
test('the selection bar arranges and attaches several cards', async ({
  page,
}) => {
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
  }
  const stacks = page.locator('.board-card-stack');
  await expect(stacks).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'On-deck' })).toBeFocused();
  const cards = stacks.locator('.primary-card').getByRole('img');
  await cards.nth(0).click();
  await cards.nth(1).click({ modifiers: ['Control'] });
  const bar = page.locator('.selection-bar');
  await expect(bar).toContainText('(2)');
  const more = async (name: string) => {
    await bar.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name }).click();
  };

  await more('Arrange in a row');
  await expect(async () => {
    const [a, b] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
    ]);
    expect(Math.round(a!.y)).toBe(Math.round(b!.y));
    expect(Math.abs(a!.x - b!.x)).toBeGreaterThan(a!.width);
  }).toPass();

  await more('Attach all to…');
  await cards.nth(2).click();
  await expect(stacks).toHaveCount(1);
  await expect(stacks.locator('.board-card')).toHaveCount(3);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Event log' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Event log' })
      .getByRole('list', { name: 'Events' })
      .getByText('Attached 2 cards'),
  ).toBeVisible();
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
    // #176: a tap enlarges the card; a drag doesn't count as one.
    await expect(page.getByRole('dialog', { name: card.name })).toBeHidden();
  });
});

// #176: players pinch-zoomed the panel to read the On-deck card.
test('a tap on the On-deck card enlarges it, and another tap closes it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  const small = page
    .getByRole('dialog', { name: 'On-deck' })
    .getByRole('img', { name: card.name });
  const smallBox = (await small.boundingBox())!;
  await small.click();

  // The panel behind is hidden from the accessibility tree meanwhile.
  const lightbox = page.getByRole('dialog', { name: card.name });
  const big = lightbox.getByRole('img', { name: card.name });
  await expect(big).toBeVisible();
  const bigBox = (await big.boundingBox())!;
  expect(bigBox.height).toBeGreaterThan(smallBox.height * 1.3);

  await big.click();
  await expect(lightbox).toBeHidden();
});

// #42
test('with card images off, cards show as text and no image loads', async ({
  page,
}) => {
  // Reload first, so pending saves land before the settings are replaced.
  await page.reload();
  await page.evaluate(() =>
    // devalue's format for { imagesEnabled: false, version: 1 } (#154)
    localStorage.setItem(
      'mtg-harmony_settings',
      JSON.stringify([{ imagesEnabled: 1, version: 2 }, false, 1]),
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

// #215: structural changes can be taken back and done again.
test('a removed card comes back with Undo, its toast or Ctrl+Z', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  const confirm = page.getByRole('dialog', { name: 'Confirm' });
  // The top row's, not a toast's.
  const undo = page.locator('button[title="Undo"]');
  async function remove() {
    await boardCard.hover();
    await page.getByRole('button', { name: 'Remove card' }).click();
    await confirm.getByRole('button', { name: 'Remove' }).click();
    await expect(boardCard).toBeHidden();
  }

  // The top row's button.
  await remove();
  await undo.click();
  await expect(boardCard).toBeVisible();

  // The removal's toast.
  await remove();
  await page
    .getByRole('region', { name: /notifications/i })
    .getByRole('button', { name: 'Undo' })
    .first()
    .click();
  await expect(boardCard).toBeVisible();

  // The keyboard, both ways.
  await remove();
  await page.keyboard.press('Control+z');
  await expect(boardCard).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
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
  expect(searches).toEqual(['(nonexistent) not:extras']);
});

// #217: Regular is on by default; Tokens and Extras widen the search.
test('Add Card filters by regular cards, tokens and extras', async ({
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
  const regular = addCard.getByRole('button', { name: 'Regular' });
  const tokens = addCard.getByRole('button', { name: 'Tokens' });

  await expect(regular).toHaveAttribute('aria-pressed', 'true');
  await expect(tokens).toHaveAttribute('aria-pressed', 'false');

  await addCard.getByRole('textbox').fill('goblin');
  await expect.poll(() => searches.at(-1)).toBe('(goblin) not:extras');

  await tokens.click();
  await expect
    .poll(() => searches.at(-1))
    .toBe('(goblin) include:extras (not:extras or t:token)');

  await regular.click();
  await expect
    .poll(() => searches.at(-1))
    .toBe('(goblin) include:extras t:token');

  await tokens.click();
  await expect(addCard.getByText('Pick at least one kind')).toBeVisible();
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

// #130: leaving the stack for the menu hid its button, so the menu jumped to 0,0.
test('the copy menu opens beside its button', async ({ page }) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await expect(page.getByRole('button', { name: 'Next card' })).toBeHidden();

  await page.locator('.board-card').getByRole('img').first().hover();
  const button = page.getByRole('button', { name: 'Copy', exact: true });
  const anchor = (await button.boundingBox())!;
  await button.click();
  const item = page.getByRole('menuitem', { name: 'Copy card +' });
  await item.hover();

  // The open menu hides the board from the accessibility tree.
  await expect(page.locator('button[aria-label="Copy"]')).toBeVisible();
  const menu = (await item.boundingBox())!;
  expect(Math.abs(menu.x - anchor.x)).toBeLessThan(40);
  expect(menu.y).toBeGreaterThan(anchor.y);
  expect(menu.y - anchor.y).toBeLessThan(150);
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
test('tapped cards stay centred on the stack', async ({ page }) => {
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

  // The primary covers the attachment's top, and its bottom may hang below
  // the window: open it from the keyboard (#212).
  await openDetails(attachment.getByRole('img'));
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

  // The primary turns in place, and the attachment stays centred on it.
  const primaryImage = primary.getByRole('img');
  const before = await centre(primaryImage);
  await openDetails(primaryImage);
  await details.getByRole('button', { name: 'Tap' }).click();
  await expect(primary).toHaveClass(/tapped/);
  await sideways(primaryImage);
  expect(Math.round((await centre(primaryImage)) - before)).toBe(0);
  expect(
    Math.round((await centre(attachment)) - (await centre(primaryImage))),
  ).toBe(0);
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
    // devalue's format for { entries: [entry], gameId: 'g1', version: 1 }
    localStorage.setItem(
      'mtg-harmony_eventLog',
      JSON.stringify([
        { entries: 1, gameId: 6, version: 7 },
        [2],
        { id: 3, at: 4, type: 5, gameId: 6 },
        entry.id,
        entry.at,
        entry.type,
        entry.gameId,
        1,
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
    // devalue's format for { cardOutlineEnabled: false, version: 1 } (#154)
    localStorage.setItem(
      'mtg-harmony_settings',
      JSON.stringify([{ cardOutlineEnabled: 1, version: 2 }, false, 1]),
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

// #167: the app shows Wizards' card names and art, so it carries their notice.
test('About shows the fan content notice and credits', async ({ page }) => {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'About' }).click();

  const about = page.getByRole('dialog', { name: 'About MTG Harmony' });
  await expect(about.getByText(/unofficial Fan Content/)).toBeVisible();
  await expect(
    about.getByText(/Not approved\/endorsed by Wizards/),
  ).toBeVisible();
  await expect(about.getByRole('link', { name: 'Scryfall' })).toHaveAttribute(
    'href',
    'https://scryfall.com',
  );
  await expect(about.getByRole('link', { name: 'Mana' })).toHaveAttribute(
    'href',
    'https://mana.andrewgioia.com',
  );
});

// #170: board cards and their actions work from the keyboard.
test('a board card and its actions can be used from the keyboard', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();

  // Tab reaches the card, then its actions, which show while focused.
  await boardCard.focus();
  await page.keyboard.press('Tab');
  const tap = page.getByRole('button', { name: 'Tap', exact: true });
  await expect(tap).toBeFocused();
  await expect(tap).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Untap', exact: true }),
  ).toBeVisible();

  // Enter on the card opens its details; closing them returns focus.
  await boardCard.focus();
  await page.keyboard.press('Enter');
  const details = page.getByRole('dialog', { name: 'Card details' });
  await expect(details).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(boardCard).toBeFocused();
});

// #212: focusing a card partly off-screen, or Playwright reaching its edge,
// scrolled the board's wrapper. The pan state didn't know, so every card
// shifted and stayed shifted.
test('focusing a card partly off-screen leaves the board where it is', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'On-deck' }).click();
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Cast to board' }).click();
  await page.keyboard.press('Escape');
  const boardCard = page.locator('.board-card').getByRole('img', {
    name: card.name,
  });
  await expect(boardCard).toBeVisible();

  // Drag the card so its lower half hangs below the window.
  const box = (await boardCard.boundingBox())!;
  const viewport = page.viewportSize()!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, viewport.height - 20, {
    steps: 5,
  });
  await page.mouse.up();
  const dragged = (await boardCard.boundingBox())!;
  expect(dragged.y + dragged.height).toBeGreaterThan(viewport.height);

  await boardCard.focus();

  const wrapper = page.locator('.board-wrapper');
  expect(
    await wrapper.evaluate((el) => ({
      top: el.scrollTop,
      left: el.scrollLeft,
    })),
  ).toEqual({ top: 0, left: 0 });
  expect((await boardCard.boundingBox())!.y).toBeCloseTo(dragged.y, 0);
});

// Tests run with reduced motion (#212); this one keeps the animations, so a
// cast still ends with a card that can be seen and focused. The card hides
// while its copy flies in, so focusing it is retried until the flight lands.
test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a cast card lands visible and focusable', async ({ page }) => {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
    const boardCard = page.locator('.board-card').getByRole('img', {
      name: card.name,
    });

    await expect(async () => {
      await boardCard.focus();
      await expect(boardCard).toBeFocused({ timeout: 100 });
    }).toPass();
    await expect(boardCard).toBeVisible();
  });
});

// #169: the installed app opens without a network.
test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('the app opens offline, with what was on the board', async ({
    page,
    context,
  }) => {
    await page.getByRole('button', { name: 'On-deck' }).click();
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Cast to board' }).click();
    const boardCard = page.locator('.board-card').getByRole('img', {
      name: card.name,
    });
    await expect(boardCard).toBeVisible();
    // The worker controls the page once it has precached the shell: it only
    // activates after its install, and then claims the page.
    await page.waitForFunction(() => {
      const sw = (
        navigator as unknown as { serviceWorker?: { controller: unknown } }
      ).serviceWorker;
      return !!sw?.controller;
    });

    await context.setOffline(true);
    await page.reload();

    await expect(boardCard).toBeVisible();
    await page.getByRole('button', { name: 'On-deck' }).click();
    await expect(page.getByText("You're offline.")).toBeVisible();
    // Whether Next card still works depends on what On-deck had queued in
    // time; the store's unit tests cover both.
  });
});

// #186: the stack's box ends where its lowest attachment does.
test.describe('a stack with attachments', () => {
  /**
   * Casts `count` cards and attaches all but the first to the first, each
   * as it's cast: only a few cards fit in view.
   */
  async function stackWithAttachments(page: Page, count: number) {
    const stacks = page.locator('.board-card-stack');
    const details = page.getByRole('dialog', { name: 'Card details' });
    for (let i = 0; i < count; i++) {
      await page.getByRole('button', { name: 'On-deck' }).click();
      await page.getByRole('button', { name: 'Next card' }).click();
      await page.getByRole('button', { name: 'Cast to board' }).click();
      if (i === 0) continue;
      await expect(stacks).toHaveCount(2);
      await stacks.nth(1).locator('.primary-card').getByRole('img').dblclick();
      await details.getByRole('button', { name: 'Attach to...' }).click();
      await stacks.nth(0).locator('.primary-card').getByRole('img').click();
      await expect(stacks).toHaveCount(1);
    }
    return stacks.first();
  }

  /**
   * Taps an attachment through its details, opened from the keyboard: cards
   * cover its top, and its bottom may hang below the window (#212).
   */
  async function tapAttachment(page: Page, index: number) {
    const attachment = page.locator('.attachment').nth(index);
    await openDetails(attachment.getByRole('img'));
    await page
      .getByRole('dialog', { name: 'Card details' })
      .getByRole('button', { name: 'Tap' })
      .click();
    await expect(attachment).toHaveClass(/tapped/);
  }

  /** How far the stack's box ends from its lowest card, in screen px. */
  async function chin(stack: Locator) {
    const cards = await stack.locator('.card-image-wrapper').all();
    let lowest = -Infinity;
    for (const card of cards) {
      const b = (await card.boundingBox())!;
      lowest = Math.max(lowest, b.y + b.height);
    }
    const box = (await stack.boundingBox())!;
    return box.y + box.height - lowest;
  }

  test('fits untapped attachments', async ({ page }) => {
    const stack = await stackWithAttachments(page, 4);

    await expect.poll(() => chin(stack)).toBeCloseTo(0, 0);
  });

  test('fits tapped and untapped attachments mixed', async ({ page }) => {
    const stack = await stackWithAttachments(page, 4);
    await tapAttachment(page, 0);
    await tapAttachment(page, 2);

    // Tapping eases (#124), so wait for it to settle.
    await expect.poll(() => chin(stack)).toBeCloseTo(0, 0);
  });

  test('fits a lone tapped attachment', async ({ page }) => {
    const stack = await stackWithAttachments(page, 2);
    await tapAttachment(page, 0);

    await expect.poll(() => chin(stack)).toBeCloseTo(0, 0);
  });
});
