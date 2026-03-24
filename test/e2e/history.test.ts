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

  test('the history entry has no Cast badge before the card is cast', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry).not.toContainText('Cast')
  })

  test('after casting, the history entry shows a Cast badge', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry).toContainText('Cast')
  })
})
