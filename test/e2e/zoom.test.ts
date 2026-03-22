import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('zoom', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
    // Cast a card onto the grid to have something to zoom.
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
  })

  test('Zoom context menu item opens the zoom overlay', async ({ page }) => {
    await page.getByAltText(mockCard.name).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Zoom' }).click()
    // The overlay renders a second copy of the card image.
    await expect(page.getByAltText(mockCard.name)).toHaveCount(2)
  })

  test('clicking the zoom overlay dismisses it', async ({ page }) => {
    await page.getByAltText(mockCard.name).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Zoom' }).click()
    await expect(page.getByAltText(mockCard.name)).toHaveCount(2)
    // Click the backdrop to dismiss.
    await page.locator('.fixed.inset-0.z-50').click()
    await expect(page.getByAltText(mockCard.name)).toHaveCount(1)
  })
})
