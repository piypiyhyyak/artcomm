import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const shots = [
  ['#iks', 'tmp_check_iks_current.png'],
  ['#expert', 'tmp_check_expert_current.png'],
  ['#contacts', 'tmp_check_contacts_current.png'],
  ['footer', 'tmp_check_footer_current.png']
];

for (const [sel, path] of shots) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await el.screenshot({ path });
}

await browser.close();
