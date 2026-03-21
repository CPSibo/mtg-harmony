import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('fetch and cast', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  test('page loads with Fetch enabled and Cast/Clear disabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Fetch' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  test('after clicking Fetch, the card image appears in the OnDeckSlot', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch' }).click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('after clicking Fetch, Cast and Clear become enabled', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch' }).click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })

  // ─── Cast ──────────────────────────────────────────────────────────────────

  test('after casting, the card image is visible in the grid', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch' }).click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    // OnDeckSlot clears (card = null) and the grid slot renders the card image.
    // Both the OnDeckSlot <img> and grid <img> use alt=card.name, so we assert
    // on the grid specifically by waiting for Cast to disable (cast completed)
    // and then verifying the image is still present in the DOM.
    await expect(page.getByRole('button', { name: 'Cast' })).toBeDisabled()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('after casting, Cast and Clear become disabled again', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch' }).click()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeEnabled()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })
})
