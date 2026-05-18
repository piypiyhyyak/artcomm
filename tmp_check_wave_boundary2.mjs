import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const y = await page.evaluate(() => {
  const el = document.getElementById('contacts');
  const rect = el.getBoundingClientRect();
  return window.scrollY + rect.top - 260;
});
await page.evaluate((yy) => window.scrollTo(0, yy), y);
await page.waitForTimeout(500);
await page.screenshot({ path: 'tmp_wave_boundary_desktop2.png' });
await browser.close();
