// V23 web visual QA: screenshots (desktop 1280 + mobile 390), horizontal-overflow and console-error check.
// usage: node qa/v23-web/screens.cjs <outDir> page.html [page.html...]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, ...pages] = process.argv.slice(2);
  const root = path.join(__dirname, '..', '..');
  const b = await chromium.launch();
  let bad = 0;
  for (const [w, h, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    for (const pg of pages) {
      await p.goto('file://' + path.join(root, pg), { waitUntil: 'domcontentloaded', timeout: 15000 });
      await p.waitForTimeout(250);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (out !== '-') await p.screenshot({ path: `${out}/${pg.replace(/\W/g, '_')}_${tag}.png`, fullPage: true });
      const e = errs.splice(0);
      if (ov || e.length) bad++;
      console.log(tag, pg, ov ? 'OVERFLOW' : 'ok', e.join(' | '));
    }
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
