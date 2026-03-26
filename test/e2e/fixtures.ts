import type { Page } from '@playwright/test'

/**
 * A deterministic mock Scryfall card used across all E2E tests.
 * The `name` is used as an `<img alt>` value in both the OnDeckSlot (expanded)
 * and the grid slot (full mode), making it a reliable DOM anchor for assertions.
 */
export const mockCard = {
  id: 'e2e-test-card-001',
  name: 'Lightning Bolt',
  mana_cost: '{R}',
  image_status: 'highres_scan',
  image_uris: { border_crop: 'https://example.com/lightning-bolt.jpg' },
  scryfall_uri: 'https://scryfall.com/card/test-001',
}

/**
 * Intercepts all outbound requests to the Scryfall API and fulfils them with
 * the mock card, preventing real network calls during tests.
 */
export async function mockScryfallRoute(page: Page): Promise<void> {
  await page.route('**/api.scryfall.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCard),
    }),
  )
}
