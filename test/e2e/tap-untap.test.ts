import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('tap and untap', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
    // Cast a card onto the grid to have something to tap.
    await page.getByText('Tap to draw a card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to draw a card').first()).toBeVisible()
  })

  test('clicking a grid card rotates it (tapped state)', async ({ page }) => {
    const cardImg = page.getByAltText(mockCard.name)
    await expect(cardImg).not.toHaveClass(/rotate-90/)
    await cardImg.click()
    await expect(cardImg).toHaveClass(/rotate-90/)
  })

  test('clicking a tapped grid card un-rotates it (untapped state)', async ({ page }) => {
    const cardImg = page.getByAltText(mockCard.name)
    await cardImg.click()
    await expect(cardImg).toHaveClass(/rotate-90/)
    await cardImg.click()
    await expect(cardImg).not.toHaveClass(/rotate-90/)
  })
})
