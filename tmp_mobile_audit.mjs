import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.screenshot({ path: 'tmp_mobile_full_top.png', fullPage: false });

const sections = [
  ['#hero', 'tmp_mobile_hero.png'],
  ['#common', 'tmp_mobile_common.png'],
  ['#ms', 'tmp_mobile_ms.png'],
  ['#iks', 'tmp_mobile_iks.png'],
  ['#expert', 'tmp_mobile_expert.png'],
  ['#contacts', 'tmp_mobile_contacts.png'],
  ['#siteFooter', 'tmp_mobile_footer.png']
];

for (const [selector, file] of sections) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await el.screenshot({ path: file });
}

await browser.close();
