// V25 public site visual QA at 360/390/768/1280/1440: horizontal overflow, console errors, one <h1>,
// screenshots. Runs twice: reduced motion (full-page screenshots show every section) and motion ON
// (decorative layers must not cause overflow or errors). usage: node qa/v25-universal/site-screens.cjs <outDir|->
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '-';
const root = path.join(__dirname, '..', '..');
const pages = ['index.html', 'industries.html', 'channels.html', 'pricing.html', 'demo.html', 'contact.html', 'faq.html', 'about.html', '404.html'];
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const motion of ['reduce', 'no-preference']) {
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1280, 900], [1440, 900]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: motion });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      for (const pg of pages) {
        await p.goto('file://' + path.join(root, pg), { waitUntil: 'load', timeout: 15000 });
        await p.waitForTimeout(motion === 'reduce' ? 150 : 600);
        if (motion !== 'reduce') { await p.mouse.wheel(0, 2500); await p.waitForTimeout(400); }
        const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        const h1 = await p.locator('h1').count();
        const hidden = motion === 'reduce' ? await p.locator('.motion-pending').count() : 0;
        if (out !== '-' && motion === 'reduce' && [390, 1280].includes(w)) await p.screenshot({ path: `${out}/site_${pg.replace('.html', '')}_${w}.png`, fullPage: true });
        const e = errs.splice(0);
        const fail = ov || e.length || h1 !== 1 || hidden;
        if (fail) bad++;
        console.log(motion.padEnd(13), String(w).padEnd(5), pg.padEnd(16), fail ? 'FAIL' : 'ok', ov ? 'OVERFLOW' : '', h1 !== 1 ? 'H1=' + h1 : '', hidden ? 'HIDDEN=' + hidden : '', e.join(' | '));
      }
      await ctx.close();
    }
  }
  await b.close();
  console.log(bad ? `T404_V25_SITE_FAIL ${bad}` : 'T404_V25_SITE_PASS');
  process.exit(bad ? 1 : 0);
})();
