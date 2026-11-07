// Renders og-image.html to public/og-image.png with Playwright's Chromium.
// Run with `npm run og-image` (needs `npx playwright install chromium` once).
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('./og-image.html', import.meta.url));
const output = fileURLToPath(
  new URL('../../public/og-image.png', import.meta.url),
);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
}
