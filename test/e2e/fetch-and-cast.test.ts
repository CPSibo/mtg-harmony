import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('fetch and cast', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  test('page loads with the OnDeck slot in empty state', async ({ page }) => {
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cast' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear' })).not.toBeVisible()
  })

  test('after clicking the OnDeck slot, the card image appears', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('after fetching, Cast and Clear become enabled', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })

  // ─── Cast ──────────────────────────────────────────────────────────────────

  test('after casting, the card image is visible in the grid', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    // OnDeckSlot returns to empty state; the grid slot retains the card image.
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
  })

  test('after casting, the OnDeck slot returns to empty state', async ({ page }) => {
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByRole('button', { name: 'Cast' })).toBeEnabled()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
  })
})
