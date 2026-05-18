import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/about';

async function measure(viewport, label){
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const common = document.querySelector('#common');
    if (!common) return;
    const y = window.scrollY + common.getBoundingClientRect().top + 980;
    window.scrollTo(0, y);
  });
  await page.waitForTimeout(700);

  const data = await page.evaluate(() => {
    const men = document.querySelector('#commonCtaMen');
    const actions = document.querySelector('.common-redo-cta .stack-actions');
    const cta = document.querySelector('.common-redo-cta-inner');
    const ctaPanel = document.querySelector('.common-redo-cta');
    if (!men || !actions || !cta || !ctaPanel) return null;
    const mr = men.getBoundingClientRect();
    const ar = actions.getBoundingClientRect();
    const cr = cta.getBoundingClientRect();
    const pr = ctaPanel.getBoundingClientRect();
    return {
      gap: Math.round(mr.top - ar.bottom),
      menW: Math.round(mr.width),
      menH: Math.round(mr.height),
      ctaW: Math.round(cr.width),
      panelW: Math.round(pr.width),
      menRatioToCta: +(mr.width / cr.width).toFixed(3),
      menRatioToPanel: +(mr.width / pr.width).toFixed(3),
      menProgress: getComputedStyle(document.querySelector('#common')).getPropertyValue('--common-men-progress').trim()
    };
  });

  console.log(label, viewport, data);
  await page.screenshot({ path: `/tmp/${label}.png`, fullPage: false });
  await browser.close();
}

await measure({ width: 1600, height: 900 }, 'common_small_now');
await measure({ width: 2048, height: 1336 }, 'common_full_now');
