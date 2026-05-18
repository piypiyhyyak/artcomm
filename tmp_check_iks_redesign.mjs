import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await desktop.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await desktop.waitForTimeout(800);
const iksDesktop = desktop.locator('#iks').first();
await iksDesktop.scrollIntoViewIfNeeded();
await desktop.waitForTimeout(300);
await iksDesktop.screenshot({ path: 'tmp_iks_redesign_desktop.png' });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await mobile.waitForTimeout(800);
const iksMobile = mobile.locator('#iks').first();
await iksMobile.scrollIntoViewIfNeeded();
await mobile.waitForTimeout(300);
await iksMobile.screenshot({ path: 'tmp_iks_redesign_mobile.png' });

await browser.close();
