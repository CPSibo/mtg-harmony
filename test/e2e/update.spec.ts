import { expect, test } from '@playwright/test';

// The app polls /version.json for a new build (#206). It checks once the page
// is idle after load, so serving a different build there shows the toast.
const NEW_BUILD = { version: '999.0.0', commit: 'fffffff' };
const TITLE = 'A new version of MTG Harmony is available';

test('the real build is current, so no toast', async ({ page }) => {
  const checked = page.waitForResponse('**/version.json');
  await page.goto('/');
  expect((await checked).ok()).toBe(true);

  await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0);
});

test.describe('a new build is out', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/version.json', (route) =>
      route.fulfill({ json: NEW_BUILD }),
    );
    await page.goto('/');
  });

  test('a toast offers to refresh, and Dismiss closes it', async ({ page }) => {
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0);
  });

  test('Refresh reloads the page', async ({ page }) => {
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();

    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Refresh' }).click();
    await reloaded;

    // The reloaded page checks again and, still served the new build, asks again.
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
  });
});
