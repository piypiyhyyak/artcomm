import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1300 } });
await page.goto('http://127.0.0.1:5173/about?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const pos = await page.evaluate(() => {
  const ids = ['hero','common','ms','iks','expert','contacts','siteFooter'];
  return ids.map(id => {
    const el = document.getElementById(id);
    if (!el) return {id, missing:true};
    const r = el.getBoundingClientRect();
    return {id, top:r.top + window.scrollY, height:r.height};
  });
});
console.log(JSON.stringify(pos,null,2));
await browser.close();
