// Manual browser check (Playwright): node qa/multichannel/widget-browser.cjs channels/widget/tien404-chat-widget.js out.png
// Mocks the n8n endpoint; never calls the real webhook.
// Browser test of the widget with a mocked endpoint (no network to n8n).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const calls = []; p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://example.test/**', async (r) => {
    const body = JSON.parse(r.request().postData());
    calls.push(body);
    const reply = body.chatInput.startsWith('Xem') ? { output: 'A003 — Áo thun | 159.000đ/cái. Còn 18 cái.', messages: ['A003 — Áo thun | 159.000đ/cái. Còn 18 cái.'], quickReplies: [] }
      : { output: '- A002 áo đen\n- A008 áo trắng', messages: ['- **A002** áo đen <script>x</script>\n- A008 áo trắng'], quickReplies: [{ label: 'Xem A002', text: 'Xem A002' }, { label: 'Xem A008', text: 'Xem A008' }] };
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await p.route('https://host.test/**', (r) => r.request().url().endsWith('.js')
    ? r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: require('fs').readFileSync(process.argv[2], 'utf8') })
    : r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><p>host</p><script src="https://host.test/w.js" data-endpoint="https://example.test/webhook/x" data-title="Shop QA"></script></body></html>' }));
  await p.goto('https://host.test/');

  await p.click('.t4w-fab');
  await p.fill('.t4w-form input', 'áo thun đen dưới 300k');
  await p.click('.t4w-form button');
  await p.waitForSelector('.t4w-qr button');
  await p.click('.t4w-qr button >> text=Xem A002');
  await p.waitForFunction(() => [...document.querySelectorAll('.t4w-bot')].length >= 3 && ![...document.querySelectorAll('.t4w-bot')].some(x => x.textContent === '…'));
  const bots = await p.$$eval('.t4w-bot', (n) => n.map((x) => x.innerHTML));
  const injected = await p.$$eval('.t4w-log script', (n) => n.length);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await p.screenshot({ path: process.argv[3] });
  console.log(JSON.stringify({ calls: calls.length, sameSession: calls[0].sessionId === calls[1].sessionId, sessionOk: /^[A-Za-z0-9]{24}$/.test(calls[0].sessionId), secondText: calls[1].chatInput, bots, injected, overflow }, null, 1));
  await b.close();
})();
