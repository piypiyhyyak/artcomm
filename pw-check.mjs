import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.stack || err.message));

await page.goto('http://127.0.0.1:4174/about', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const stats = await page.evaluate(() => {
  const mount = document.querySelector('#heroLanyardMount');
  const canvas = mount?.querySelector('canvas');
  return {
    hasMount: !!mount,
    hasCanvas: !!canvas,
    mountChildren: mount ? mount.childElementCount : null,
    canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null,
    mountRect: mount ? {
      x: mount.getBoundingClientRect().x,
      y: mount.getBoundingClientRect().y,
      w: mount.getBoundingClientRect().width,
      h: mount.getBoundingClientRect().height
    } : null,
    inner: mount ? mount.innerHTML.slice(0, 400) : null
  };
});

console.log('[stats]', JSON.stringify(stats, null, 2));
await page.screenshot({ path: '/tmp/pw-debug.png' });
await browser.close();
