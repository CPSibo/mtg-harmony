import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('prefetch queue', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  test('fetching a card works when the prefetch queue has cards ready', async ({ page }) => {
    // The app seeds the queue on mount; wait for at least one prefetch to land.
    // The mock route always responds instantly so the queue fills quickly.
    await page.waitForTimeout(200)

    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('multiple sequential fetches all succeed', async ({ page }) => {
    // Allow the queue to pre-fill before starting rapid fetches.
    await page.waitForTimeout(300)

    for (let i = 0; i < 3; i++) {
      // Wait for the empty state, then click to fetch.
      await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
      await page.getByText('Tap to fetch a random card').first().click()
      await expect(page.getByAltText(mockCard.name)).toBeVisible()
      // Clear so we can fetch again.
      await page.getByRole('button', { name: 'Clear' }).click()
    }
  })

  test('disabling prefetch in settings does not break fetching', async ({ page }) => {
    // Disable prefetch.
    await page.getByLabel('Open settings').click()
    await page.getByRole('button', { name: 'Off' }).click()
    await page.keyboard.press('Escape')

    // Fetching should still work via the direct network path.
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('prefetch toggle shows On and Off buttons in the settings modal', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    // Both buttons for the Prefetch cards toggle must be visible.
    const settingsPanel = page.locator('.fixed.inset-0').last()
    await expect(settingsPanel.getByRole('button', { name: 'On' })).toBeVisible()
    await expect(settingsPanel.getByRole('button', { name: 'Off' })).toBeVisible()
  })

  test('reset app clears the prefetch queue', async ({ page }) => {
    // Track network requests to the Scryfall API.
    const requests: string[] = []
    page.on('request', req => {
      if (req.url().includes('api.scryfall.com')) requests.push(req.url())
    })

    // Allow some prefetch requests to accumulate.
    await page.waitForTimeout(300)
    const beforeReset = requests.length

    // Reset the app via the settings modal.
    await page.getByLabel('Open settings').click()
    await page.getByRole('button', { name: 'Reset app' }).click()
    const confirmDialog = page.locator('.fixed.inset-0').last()
    await confirmDialog.getByRole('button', { name: 'Reset' }).click()

    // After reset, new prefetch requests should start (queue was cleared + refilled).
    await page.waitForTimeout(300)
    expect(requests.length).toBeGreaterThan(beforeReset)
  })
})
