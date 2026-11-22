// Read-only probe of the LIVE owner App: loads pages, records console errors and failed requests,
// tries a sign-in with an obviously wrong password (no account is created). Prints findings only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  p.on('console', m => { if (m.type() !== 'log') logs.push(`console.${m.type()}: ${m.text().slice(0, 300)}`); });
  p.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('requestfailed', r => logs.push(`requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  p.on('response', r => { if (r.status() >= 400) logs.push(`http ${r.status()}: ${r.url().slice(0, 140)}`); });
  for (const u of ['https://ngoctien20.github.io/demo-git/app/', 'https://ngoctien20.github.io/demo-git/app/#/dang-ky',
                   'https://ngoctien20.github.io/demo-git/', 'https://ngoctien20.github.io/demo-git/login.html']) {
    try { const r = await p.goto(u, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { logs.push('goto ' + u + ' ' + e.message.slice(0, 120)); }
    await p.waitForTimeout(1500);
    const text = (await p.evaluate(() => document.body ? document.body.innerText : '')).replace(/\s+/g, ' ').slice(0, 400);
    console.log(`PAGE ${u}\n  final=${p.url()}\n  title=${await p.title()}\n  text=${text}`);
    const links = await p.evaluate(() => [...document.querySelectorAll('a')].filter(a => /Đăng (nhập|ký)|Dùng thử/.test(a.textContent)).map(a => a.textContent.trim() + ' -> ' + a.getAttribute('href')).slice(0, 6));
    if (links.length) console.log('  auth-links=' + links.join(' | '));
    await p.screenshot({ path: `probe-${encodeURIComponent(u).slice(-30)}.png` });
  }
  // try a login with a wrong password on the App
  await p.goto('https://ngoctien20.github.io/demo-git/app/#/dang-nhap', { waitUntil: 'networkidle' });
  const email = p.locator('input[type=email]'); const pw = p.locator('input[type=password]');
  if (await email.count()) {
    await email.first().fill('probe-not-a-user@example.com'); await pw.first().fill('wrong-password-123');
    await p.locator('form button[type=submit]').first().click(); await p.waitForTimeout(4000);
    console.log('LOGIN_ATTEMPT text=' + (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300));
  } else console.log('LOGIN_FORM_MISSING');
  console.log('--- LOGS\n' + logs.join('\n'));
  await b.close();
})();
