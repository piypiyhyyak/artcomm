import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const pos = await page.evaluate(() => {
  const expert = document.getElementById('expert').getBoundingClientRect();
  const contacts = document.getElementById('contacts').getBoundingClientRect();
  return {
    expertTop: expert.top + window.scrollY,
    expertBottom: expert.bottom + window.scrollY,
    contactsTop: contacts.top + window.scrollY,
  };
});
const targetY = Math.max(0, pos.expertBottom - 520);
await page.evaluate((y) => window.scrollTo(0, y), targetY);
await page.waitForTimeout(500);
await page.screenshot({ path: 'tmp_expert_contacts_boundary_desktop.png' });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await mobile.waitForTimeout(1500);
const posM = await mobile.evaluate(() => {
  const expert = document.getElementById('expert').getBoundingClientRect();
  const contacts = document.getElementById('contacts').getBoundingClientRect();
  return {
    expertBottom: expert.bottom + window.scrollY,
    contactsTop: contacts.top + window.scrollY,
  };
});
const targetYM = Math.max(0, posM.expertBottom - 360);
await mobile.evaluate((y) => window.scrollTo(0, y), targetYM);
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: 'tmp_expert_contacts_boundary_mobile.png' });
await browser.close();
