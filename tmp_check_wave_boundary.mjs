import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const contacts = page.locator('#contacts').first();
await contacts.scrollIntoViewIfNeeded();
const box = await contacts.boundingBox();
if (box) {
  const y = Math.max(0, box.y - 260);
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
}
await page.waitForTimeout(500);
await page.screenshot({ path: 'tmp_wave_boundary_desktop.png', fullPage: false });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await mobile.waitForTimeout(1200);
const c2 = mobile.locator('#contacts').first();
await c2.scrollIntoViewIfNeeded();
const b2 = await c2.boundingBox();
if (b2) {
  const y2 = Math.max(0, b2.y - 120);
  await mobile.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y2);
}
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: 'tmp_wave_boundary_mobile.png', fullPage: false });

await browser.close();
