import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('history modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  test('history modal shows empty state before any fetch', async ({ page }) => {
    await page.getByLabel('View history').click()
    await expect(page.getByText('No cards fetched yet.')).toBeVisible()
  })

  test('after a fetch, the card appears as an entry in history', async ({ page }) => {
    await page.getByText('Tap to draw a card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByLabel('View history').click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('link', { name: mockCard.name })).toBeVisible()
  })

  test('the history entry has no Cast badge before the card is cast', async ({ page }) => {
    await page.getByText('Tap to draw a card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry).not.toContainText('Cast')
  })

  test('after casting, the history entry shows a Cast badge', async ({ page }) => {
    await page.getByText('Tap to draw a card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to draw a card').first()).toBeVisible()
    await page.getByLabel('View history').click()
    const entry = page.getByRole('listitem').first()
    await expect(entry).toContainText('Cast')
  })
})
