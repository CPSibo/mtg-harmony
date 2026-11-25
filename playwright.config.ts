import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The HTML report is uploaded from CI on failure; open it locally with
  // `npx playwright show-report`.
  reporter: [
    process.env.CI ? ['github'] : ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // The production build registers a service worker (#169). Requests it
    // makes skip page.route, so tests block it unless they test it.
    serviceWorkers: 'block',
    // Tests check where things end up, not how they get there. Cast flights,
    // move animations and tap easing are decoration the app skips under
    // reduced motion; left on, tests that measure or focus a card race them
    // and flake under load (#212). A test of an animation itself opts back in
    // with test.use({ reducedMotion: 'no-preference' }).
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Test the production build, not the dev server.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
