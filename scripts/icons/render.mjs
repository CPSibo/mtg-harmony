// Renders icon.html to the app icons in public/icons/ with Playwright's
// Chromium. Run with `npm run icons` (needs `npx playwright install chromium`).
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = pathToFileURL(
  fileURLToPath(new URL('./icon.html', import.meta.url)),
).href;
const outDir = new URL('../../public/icons/', import.meta.url);

const icons = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, maskable } of icons) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.goto(source + (maskable ? '?maskable' : ''));
    await page.evaluate(() => document.fonts.ready);
    const output = fileURLToPath(new URL(file, outDir));
    await page.screenshot({ path: output });
    await page.close();
    console.log(`Wrote ${output}`);
  }
} finally {
  await browser.close();
}
