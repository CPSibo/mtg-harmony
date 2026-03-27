import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('history modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  test.describe('share history button', () => {
    test.beforeEach(async ({ page }) => {
      // Inject a Web Share API mock so the share button is visible and callable.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', {
          value: async (data: ShareData) => {
            (window as unknown as Record<string, unknown>).__lastShareData = data
          },
          configurable: true,
        })
      })
      await page.goto('/')
    })

    test('share button appears in history modal when entries exist', async ({ page }) => {
      await page.getByText('Tap to fetch a random card').first().click()
      await expect(page.getByAltText(mockCard.name)).toBeVisible()
      await page.getByLabel('View history').click()
      await expect(page.getByLabel('Share history')).toBeVisible()
    })

    test('share button is not shown when history is empty', async ({ page }) => {
      await page.getByLabel('View history').click()
      await expect(page.getByLabel('Share history')).not.toBeVisible()
    })

    test('clicking share calls navigator.share with raw history text', async ({ page }) => {
      await page.getByText('Tap to fetch a random card').first().click()
      await expect(page.getByAltText(mockCard.name)).toBeVisible()
      await page.getByLabel('View history').click()
      await page.getByLabel('Share history').click()
      const shareData = await page.evaluate(() =>
        (window as unknown as Record<string, unknown>).__lastShareData,
      )
      expect(shareData).toMatchObject({ title: 'MTG History', text: mockCard.name })
    })
  })

  test('history modal shows empty state before any fetch', async ({ page }) => {
    await page.getByLabel('View history').click()
    await expect(page.getByText('No cards fetched yet.')).toBeVisible()
  })

  test('after a fetch, the card appears as an entry in history', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByLabel('View history').click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('link', { name: mockCard.name })).toBeVisible()
  })

  test('the history entry has no "Was cast" indicator before the card is cast', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry.locator('[aria-label="Was cast"]')).not.toBeVisible()
  })

  test('after casting, the history entry shows a "Was cast" indicator', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry.locator('[aria-label="Was cast"]')).toBeVisible()
  })

  test('casting from history adds the card to the grid', async ({ page }) => {
    // Fetch a card so it appears in both OnDeck and history
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()

    // Open history and cast the card from there
    await page.getByLabel('View history').click()
    await page.getByLabel('Cast to grid').first().click()
    await page.getByLabel('Close history').click()

    // The card should be visible in the grid (also still present in OnDeck slot)
    await expect(page.getByAltText(mockCard.name).first()).toBeVisible()
  })

  test('casting from history marks the entry as cast', async ({ page }) => {
    // Fetch a card — the history entry starts as uncast
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()

    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    // The entry is not yet cast (no "Was cast" indicator)
    await expect(entry.locator('[aria-label="Was cast"]')).not.toBeVisible()

    await page.getByLabel('Cast to grid').first().click()
    await expect(entry.locator('[aria-label="Was cast"]')).toBeVisible()
  })

  test('casting from history does not affect the on-deck slot', async ({ page }) => {
    // Fetch a card so it is on deck
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cast', exact: true })).toBeEnabled()

    // Cast from history while the card is still on deck
    await page.getByLabel('View history').click()
    await page.getByLabel('Cast to grid').first().click()
    await page.getByLabel('Close history').click()

    // The on-deck card should still be there
    await expect(page.getByRole('button', { name: 'Cast', exact: true })).toBeEnabled()
  })
})
