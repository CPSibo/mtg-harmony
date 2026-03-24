import { test, expect } from '@playwright/test'
import { mockCard, mockScryfallRoute } from './fixtures'

test.describe('settings modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('settings modal opens when the Settings button is clicked', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('settings modal closes when ESC is pressed', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible()
  })
})

test.describe('wake lock toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('keep screen awake toggle is visible in the settings modal', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    await expect(page.getByText('Keep screen awake')).toBeVisible()
  })

  test('clicking On activates the wake lock setting', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    // Disable first, wait for re-render, then disable.
    await page.getByRole('button', { name: 'wake lock off' }).click()
    await expect(page.getByRole('button', { name: 'wake lock off' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'wake lock on' }).click()
    await expect(page.getByRole('button', { name: 'wake lock on' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Off deactivates the wake lock setting', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    await page.getByRole('button', { name: 'wake lock off' }).click()
    await expect(page.getByRole('button', { name: 'wake lock off' })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('clear grid', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfallRoute(page)
    await page.goto('/')
  })

  test('clicking Clear grid shows a confirmation dialog', async ({ page }) => {
    await page.getByLabel('Open settings').click()
    await page.getByRole('button', { name: 'Clear grid' }).click()
    await expect(page.getByRole('heading', { name: 'Clear grid?' })).toBeVisible()
  })

  test('confirming Clear grid removes all cards from the grid', async ({ page }) => {
    // Add a card to the grid first.
    await page.getByText('Tap to fetch a random card').first().click()
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    await page.getByRole('button', { name: 'Cast' }).click()
    await expect(page.getByText('Tap to fetch a random card').first()).toBeVisible()
    // The card image should now be in the grid.
    await expect(page.getByAltText(mockCard.name)).toBeVisible()
    // Clear the grid via the settings modal.
    await page.getByLabel('Open settings').click()
    await page.getByRole('button', { name: 'Clear grid' }).click()
    // The confirm dialog (HamburgerMenu uses confirm-label="Clear") is the last
    // fixed overlay in the DOM. Scope to it to avoid matching the disabled
    // "Clear" button in the OnDeckSlot controls.
    const confirmDialog = page.locator('.fixed.inset-0').last()
    await expect(confirmDialog.getByRole('heading', { name: 'Clear grid?' })).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Clear' }).click()
    // The grid card image should no longer be visible.
    await expect(page.getByAltText(mockCard.name)).not.toBeVisible()
  })
})
