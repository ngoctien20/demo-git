// V23 owner App — browser UI QA with a MOCKED Supabase (no network, no real accounts).
// Serves the built app (../../app) on an in-process HTTP server, injects a fake session and answers
// /rest/v1 and /auth/v1 from fixtures. Checks: every route renders, no console errors, no horizontal
// overflow at 1280 and 390 px, RPC payloads are what the DB expects. usage: node qa/v23-web/app-ui.cjs <outDir|->
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2] || '-';
const REF = 'ifxlvrhyjhbzbrkdsida';
const UID = 'd0000000-0000-4000-8000-0000000000e1', T1 = 't0000000-0000-4000-8000-000000000001', S1 = 's0000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const fx = {
  store_memberships: [{ store_id: S1, tenant_id: T1, role: 'owner' }],
  stores: [{ id: S1, tenant_id: T1, name: 'Shop Hoa Mai', is_default: true }],
  tenants: [{ id: T1, name: 'Shop Hoa Mai' }],
  products: [
    { id: 'p1', sku: 'AO-SOMI-TRANG-M', name: 'Áo sơ mi trắng size M', price_vnd: 289000, stock_on_hand: 12, is_active: true, updated_at: now },
    { id: 'p2', sku: 'QUAN-TAY-DEN-30', name: 'Quần tây đen size 30', price_vnd: 350000, stock_on_hand: 2, is_active: true, updated_at: now },
    { id: 'p3', sku: 'VAY-HOA-S', name: 'Váy hoa nhí size S', price_vnd: 420000, stock_on_hand: 0, is_active: false, updated_at: now }],
  orders: [
    { id: 'o1aaaaaa-0000', status: 'pending', total_vnd: 578000, order_source: 'messenger', created_at: now, customer_id: 'c1' },
    { id: 'o2bbbbbb-0000', status: 'paid', total_vnd: 350000, order_source: 'zalo', created_at: now, customer_id: 'c2' }],
  customers: [
    { id: 'c1', display_name: 'Chị Lan', phone: '0912345678', email: null, created_at: now, stage: 'hot', follow_up_at: now, note: 'Hẹn gọi chiều nay' },
    { id: 'c2', display_name: 'Anh Minh', phone: null, email: 'minh@example.com', created_at: now, stage: 'won', follow_up_at: null, note: null },
    { id: 'c3', display_name: 'Khách Zalo 3', phone: null, email: null, created_at: now, stage: 'needs_human', follow_up_at: null, note: 'Đòi gặp chủ shop' }],
  order_items: [{ quantity: 2, unit_price_vnd: 289000, line_total_vnd: 578000, products: { sku: 'AO-SOMI-TRANG-M', name: 'Áo sơ mi trắng size M' } }],
  store_bot_settings: [{ shop_info: 'Mở cửa 8:00–21:00. Giao toàn quốc 2–4 ngày.', forbidden_promises: 'Không hứa giao trong ngày', tone: 'friendly', bot_enabled: true, notify_emails: ['owner@example.com'], updated_at: now }],
  store_faqs: [{ id: 'f1', question: 'Shop có đổi trả không?', answer: 'Đổi trong 7 ngày nếu còn tem mác.', active: true, updated_at: now }],
};
const rpcCalls = [];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    const idx = path.join(p, 'index.html');
    if (fs.existsSync(idx)) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(idx)); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(fs.readFileSync(p));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/app/`;
  const b = await chromium.launch();
  let bad = 0;
  const session = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 9999999999 })).toString('base64url') + '.y', token_type: 'bearer',
    expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: { id: UID, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
  async function page(w, h, { loggedIn = true, noStores = false } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    if (loggedIn) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
    await ctx.route(/supabase\.co\//, async route => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: session.user }) });
      const m = u.pathname.match(/\/rest\/v1\/(rpc\/)?(\w+)/);
      if (m && m[1]) { rpcCalls.push({ fn: m[2], body: route.request().postDataJSON() }); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(now) }); }
      let rows = (noStores && ['store_memberships', 'stores'].includes(m[2])) ? [] : (fx[m[2]] || []);
      for (const [k, v] of u.searchParams) if (v.startsWith('eq.') && rows[0] && k in rows[0]) rows = rows.filter(r => String(r[k]) === v.slice(3));
      const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
        body: route.request().method() === 'HEAD' ? '' : JSON.stringify(single ? (rows[0] ?? null) : rows) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    return { p, errs, ctx };
  }
  async function check(p, errs, name, tag) {
    await p.waitForTimeout(400);
    const spinning = await p.locator('.spinner').count();
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const h1 = await p.locator('h1').first().textContent().catch(() => '');
    if (out !== '-') await p.screenshot({ path: `${out}/app_${name}_${tag}.png`, fullPage: true });
    const e = errs.splice(0); if (ov || e.length || spinning) bad++;
    console.log(tag, name.padEnd(12), (h1 || '').trim().padEnd(26), ov ? 'OVERFLOW' : 'ok', spinning ? 'STILL_LOADING' : '', e.join(' | '));
  }
  const routes = ['/', '/san-pham', '/don-hang', '/khach-hang', '/cai-dat-bot', '/tri-thuc', '/kenh-ban', '/goi-dich-vu', '/tai-khoan'];
  for (const [w, h, tag] of [[1280, 860, 'd'], [390, 844, 'm']]) {
    { const { p, errs, ctx } = await page(w, h, { loggedIn: false }); await p.goto(base + '#/dang-nhap'); await check(p, errs, 'login', tag);
      await p.goto(base + '#/dang-ky'); await check(p, errs, 'signup', tag); await ctx.close(); }
    { const { p, errs, ctx } = await page(w, h, { noStores: true }); await p.goto(base + '#/'); await check(p, errs, 'onboarding', tag); await ctx.close(); }
    const { p, errs, ctx } = await page(w, h);
    for (const r of routes) { await p.goto(base + '#' + r); await check(p, errs, r === '/' ? 'overview' : r.slice(1), tag); }
    if (tag === 'd') {
      await p.goto(base + '#/san-pham'); await p.waitForTimeout(300);
      await p.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
      await p.getByLabel('Mã SKU').fill('AO-01'); await p.getByLabel('Tên sản phẩm').fill('Áo thun');
      await p.getByLabel('Giá bán (VND)').fill('1.2tr'); await p.getByRole('button', { name: 'Lưu' }).click();
      const refused = await p.getByText('Không dùng “k”, “tr”').count();
      await p.getByLabel('Giá bán (VND)').fill('199.000'); await p.getByRole('button', { name: 'Lưu' }).click(); await p.waitForTimeout(300);
      await check(p, errs, 'product-add', tag);
      await p.goto(base + '#/cai-dat-bot'); await p.waitForTimeout(300);
      await p.getByRole('switch').click(); await p.waitForTimeout(300);
      const add = rpcCalls.find(c => c.fn === 'save_merchant_product_in_store');
      const tog = rpcCalls.find(c => c.fn === 'save_store_bot_settings');
      const okAdd = refused === 1 && add && add.body.p_price === 199000 && add.body.p_initial_stock === 0 && add.body.p_expected_updated_at === null && add.body.p_store === S1;
      const okTog = tog && tog.body.p_bot_enabled === false && tog.body.p_expected_updated_at === now && tog.body.p_tone === 'friendly';
      console.log('RPC text-price refused + save_merchant_product_in_store payload', okAdd ? 'ok' : 'FAIL ' + JSON.stringify(add));
      console.log('RPC save_store_bot_settings toggle payload', okTog ? 'ok' : 'FAIL ' + JSON.stringify(tog));
      if (!okAdd || !okTog) bad++;
    }
    await ctx.close();
  }
  await b.close(); server.close();
  console.log(bad ? `T404_V23_APP_UI_FAIL ${bad}` : 'T404_V23_APP_UI_PASS');
  process.exit(bad ? 1 : 0);
})();
