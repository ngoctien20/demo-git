// V25 Universal Workspace — browser QA with a MOCKED Supabase (no network, no real accounts, no hosted DB).
// MOCK ONLY: this proves UI behaviour and request shapes. It is NOT hosted UAT and says nothing about
// production RLS (hosted RLS evidence lives in qa/config-core/hosted + qa/v23-web/hosted).
//
// The mock imitates RLS: every table row carries store_id and the mock only returns rows of Stores the
// signed-in user is an active member of, so a UI that forgot a filter would still not see other tenants;
// we additionally assert the App itself always filters by the CURRENT store.
//
// usage: node qa/v25-universal/workspace-ui.cjs <outDir|->
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2] || '-';
const REF = 'ifxlvrhyjhbzbrkdsida';
const now = new Date().toISOString();
const U = { shopOwner: 'd0000000-0000-4000-8000-0000000000a1', artistOwner: 'd0000000-0000-4000-8000-0000000000b1', staff: 'd0000000-0000-4000-8000-0000000000c1', eduOwner: 'd0000000-0000-4000-8000-0000000000d1' };
const T = { A: 't-a', B: 't-b', E: 't-e' };
const S = { A: 's-a', B: 's-b', E: 's-e' };

const shopCfg = { schema_version: 1, greeting: 'Chào bạn! Mình là trợ lý của shop.', addressing: { self: 'mình', customer: 'bạn' }, menu: [
  { id: 'catalog', action_type: 'SHOW_CATALOG', label: 'Xem sản phẩm', enabled: true, sort_order: 10, action_config: {} },
  { id: 'order_lookup', action_type: 'ORDER_LOOKUP', label: 'Tra cứu đơn hàng', enabled: true, sort_order: 20, action_config: {} },
  { id: 'website', action_type: 'OPEN_LINK', label: 'Xem website', enabled: false, sort_order: 30, action_config: { url: 'https://example.com/THAY-LINK-WEBSITE', link_kind: 'website' } },
  { id: 'handoff', action_type: 'HUMAN_HANDOFF', label: 'Gặp nhân viên', enabled: true, sort_order: 40, action_config: { team: 'sales' } }] };
const artistCfg = { schema_version: 1, greeting: 'Chào bạn! Bạn muốn nghe nhạc, xem thông tin hay liên hệ quản lý?', addressing: { self: 'mình', customer: 'bạn' }, menu: [
  { id: 'music', action_type: 'SHOW_PLAYLIST', label: 'Nghe nhạc', enabled: false, sort_order: 10, action_config: { url: 'https://www.youtube.com/@THAY-LINK-PLAYLIST' } },
  { id: 'profile', action_type: 'SHOW_PROFILE', label: 'Thông tin nghệ sĩ', enabled: true, sort_order: 20, action_config: {} },
  { id: 'youtube', action_type: 'OPEN_LINK', label: 'Kênh YouTube', enabled: false, sort_order: 30, action_config: { url: 'https://www.youtube.com/@THAY-LINK-KENH', link_kind: 'youtube' } },
  { id: 'manager', action_type: 'HUMAN_HANDOFF', label: 'Liên hệ quản lý', enabled: true, sort_order: 40, action_config: { team: 'manager' } }] };
const eduCfg = { schema_version: 1, greeting: 'Chào bạn! Mình có thể giới thiệu khóa học.', menu: [
  { id: 'courses', action_type: 'SHOW_SERVICES', label: 'Xem khóa học', enabled: true, sort_order: 10, action_config: { items: [] } },
  { id: 'manager', action_type: 'HUMAN_HANDOFF', label: 'Liên hệ quản lý', enabled: true, sort_order: 20, action_config: { team: 'manager' } }] };

const fx = {
  memberships: [
    { user: U.shopOwner, store_id: S.A, tenant_id: T.A, role: 'owner' },
    { user: U.artistOwner, store_id: S.B, tenant_id: T.B, role: 'owner' },
    { user: U.staff, store_id: S.A, tenant_id: T.A, role: 'staff' },
    { user: U.eduOwner, store_id: S.E, tenant_id: T.E, role: 'owner' }],
  stores: [{ id: S.A, tenant_id: T.A, name: 'Shop Hoa Mai', is_default: true, store_id: S.A }, { id: S.B, tenant_id: T.B, name: 'Ban nhạc Gió Bấc', is_default: true, store_id: S.B }, { id: S.E, tenant_id: T.E, name: 'Trung tâm Sao Mai', is_default: true, store_id: S.E }],
  tenants: [{ id: T.A, name: 'Shop Hoa Mai', industry: 'fashion', store_id: S.A }, { id: T.B, name: 'Ban nhạc Gió Bấc', industry: 'artist', store_id: S.B }, { id: T.E, name: 'Trung tâm Sao Mai', industry: 'education', store_id: S.E }],
  products: [{ id: 'p1', sku: 'AO-SOMI-TRANG-M', name: 'Áo sơ mi trắng size M', price_vnd: 289000, stock_on_hand: 12, is_active: true, updated_at: now, store_id: S.A }],
  orders: [{ id: 'o1aaaaaa-0000', status: 'pending', total_vnd: 578000, order_source: 'messenger', created_at: now, customer_id: 'c1', store_id: S.A }],
  customers: [{ id: 'c1', display_name: 'Chị Lan', phone: '0912345678', email: null, created_at: now, stage: 'needs_human', follow_up_at: null, note: 'Đòi gặp chủ shop', store_id: S.A },
    { id: 'cb', display_name: 'Fan Gió Bấc', phone: null, email: null, created_at: now, stage: 'new', follow_up_at: null, note: null, store_id: S.B }],
  conversations: [],
  order_items: [],
  store_bot_settings: [{ shop_info: 'Mở cửa 8:00–21:00.', forbidden_promises: '', tone: 'friendly', bot_enabled: true, notify_emails: ['owner@example.com'], updated_at: now, store_id: S.A }],
  store_faqs: [{ id: 'f1', question: 'Shop có đổi trả không?', answer: 'Đổi trong 7 ngày.', active: true, updated_at: now, store_id: S.A }],
  assistants: [{ id: 'a-shop', name: 'Trợ lý Shop Hoa Mai', template_key: 'shop', status: 'active', created_at: now, store_id: S.A },
    { id: 'a-artist', name: 'Trợ lý Gió Bấc', template_key: 'artist', status: 'active', created_at: now, store_id: S.B },
    { id: 'a-edu', name: 'Trợ lý Sao Mai', template_key: 'education', status: 'active', created_at: now, store_id: S.E }],
  industry_templates: [{ template_key: 'artist', name: 'Nghệ sĩ / Nhà sáng tạo', industry: 'creator', version: 1 }, { template_key: 'education', name: 'Nội dung / Giáo dục', industry: 'education', version: 1 },
    { template_key: 'service', name: 'Dịch vụ', industry: 'service', version: 1 }, { template_key: 'shop', name: 'Cửa hàng', industry: 'retail', version: 1 }],
  assistant_config_versions: [
    { assistant_id: 'a-shop', store_id: S.A, version_no: 3, state: 'draft', config: shopCfg, config_sha256: 'shaA3', source: 'edit', created_at: now, published_at: null },
    { assistant_id: 'a-shop', store_id: S.A, version_no: 2, state: 'published', config: shopCfg, config_sha256: 'shaA2', source: 'edit', created_at: now, published_at: now },
    { assistant_id: 'a-shop', store_id: S.A, version_no: 1, state: 'superseded', config: shopCfg, config_sha256: 'shaA1', source: 'template:shop@1', created_at: now, published_at: now },
    { assistant_id: 'a-artist', store_id: S.B, version_no: 1, state: 'draft', config: artistCfg, config_sha256: 'shaB1', source: 'template:artist@1', created_at: now, published_at: null },
    { assistant_id: 'a-edu', store_id: S.E, version_no: 1, state: 'draft', config: eduCfg, config_sha256: 'shaE1', source: 'template:education@1', created_at: now, published_at: null }],
  channel_connections: [{ id: 'cc1', channel: 'messenger', display_name: 'Fanpage demo Hoa Mai', environment: 'demo', status: 'active', assistant_id: 'a-shop', updated_at: now, store_id: S.A }],
};

const rpcCalls = []; const reads = [];
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

let bad = 0;
const fail = (m) => { bad++; console.log('FAIL', m); };
const ok = (cond, m) => (cond ? console.log('ok  ', m) : fail(m));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/app/`;
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});

  async function page(w, h, uid, email, missing = []) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const session = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: uid, exp: 9999999999 })).toString('base64url') + '.y', token_type: 'bearer',
      expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: { id: uid, email, aud: 'authenticated', role: 'authenticated' } };
    await ctx.addInitScript(([k, v]) => { try { localStorage.clear(); } catch {} localStorage.setItem(k, v); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
    const mine = fx.memberships.filter(m => m.user === uid);
    const myStores = new Set(mine.map(m => m.store_id));
    await ctx.route(/supabase\.co\//, async route => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: session.user }) });
      const m = u.pathname.match(/\/rest\/v1\/(rpc\/)?(\w+)/);
      if (missing.includes(m && m[2])) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: `Could not find the ${m[1] ? 'function' : 'table'} public.${m[2]} in the schema cache` }) });
      if (m && m[1] && m[2] === 'save_workspace_profile') { const bd = route.request().postDataJSON(); fx.workspace_profiles = [...(fx.workspace_profiles || []).filter(r => r.store_id !== bd.p_store), { store_id: bd.p_store, label: bd.p_label, modules: bd.p_modules, people_label: bd.p_people_label, updated_at: now }]; }
      if (m && m[1]) { rpcCalls.push({ uid, fn: m[2], body: route.request().postDataJSON() }); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m[2] === 'create_assistant' ? 'a-new' : now) }); }
      const table = m[2];
      reads.push({ uid, table, q: u.search });
      let rows = table === 'store_memberships' ? mine.map(({ user, ...r }) => r)
        : table === 'industry_templates' ? fx.industry_templates
          : (fx[table] || []).filter(r => myStores.has(r.store_id)); // RLS imitation
      for (const [k, v] of u.searchParams) {
        if (v.startsWith('eq.')) rows = rows.filter(r => !(k in r) || String(r[k]) === v.slice(3));
        else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(','); rows = rows.filter(r => !(k in r) || set.includes(String(r[k]))); }
      }
      const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
        body: route.request().method() === 'HEAD' ? '' : JSON.stringify(single ? (rows[0] ?? null) : rows) });
    });
    // Zalo Hub owner self-connect (gateway/zalo-hub /v1/owner/*): fixture = store has no Zalo bot yet.
    await ctx.route(/zalo-hub[^/]*\.workers\.dev\//, route => route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, connection: null }) }));
    await ctx.route('**/v1/owner/care/inbox', route => route.fulfill({
      json: {ok:true, plan:'lite', paused:false, rows:[], contact:{phone:'',zalo:''}},
    }));
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    return { p, errs, ctx };
  }
  async function check(p, errs, name, tag) {
    await p.waitForTimeout(350);
    const spinning = await p.locator('.spinner').count();
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const h1 = await p.locator('h1').first().textContent().catch(() => '');
    if (out !== '-' && (tag === '390' || tag === '1280' || name === 'overview')) await p.screenshot({ path: `${out}/ws_${name}_${tag}.png`, fullPage: true });
    const e = errs.splice(0);
    if (ov || e.length || spinning) bad++;
    console.log(tag.padEnd(5), name.padEnd(16), (h1 || '').trim().slice(0, 30).padEnd(31), ov ? 'OVERFLOW' : 'ok', spinning ? 'STILL_LOADING' : '', e.join(' | '));
  }

  // 1. Every route, every viewport, shop owner + artist owner.
  const shopRoutes = ['/', '/tro-ly', '/menu-tro-ly', '/tri-thuc', '/kenh-ban', '/hoi-thoai', '/san-pham', '/don-hang', '/khach-hang', '/bao-cao', '/thong-bao', '/cai-dat-bot', '/phong-cach', '/goi-dich-vu', '/tai-khoan'];
  const artistRoutes = ['/', '/tro-ly', '/nghe-si', '/menu-tro-ly', '/kenh-ban', '/khach-hang', '/bao-cao', '/phong-cach'];
  for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1280, 860], [1440, 900]]) {
    const tag = String(w);
    { const { p, errs, ctx } = await page(w, h, U.shopOwner, 'shop@example.com');
      for (const r of shopRoutes) { await p.goto(base + '#' + r); await check(p, errs, 'shop' + (r === '/' ? '-overview' : r.replace('/', '-')), tag); }
      await ctx.close(); }
    { const { p, errs, ctx } = await page(w, h, U.artistOwner, 'artist@example.com');
      for (const r of artistRoutes) { await p.goto(base + '#' + r); await check(p, errs, 'artist' + (r === '/' ? '-overview' : r.replace('/', '-')), tag); }
      await ctx.close(); }
  }

  // 2. Industry-aware navigation.
  { const { p, ctx } = await page(1280, 860, U.shopOwner, 'shop@example.com');
    await p.goto(base + '#/'); await p.waitForTimeout(400);
    const nav = await p.locator('nav[aria-label="Menu Workspace"]').innerText();
    ok(nav.includes('Sản phẩm & tồn kho') && nav.includes('Đơn hàng') && !nav.includes('Hồ sơ & âm nhạc'), 'shop workspace nav: products/orders, no artist module');
    ok(nav.includes('Trợ lý AI') && nav.includes('Menu & hành động') && nav.includes('Kho kiến thức') && nav.includes('Kênh kết nối') && nav.includes('Hội thoại & bàn giao') && nav.includes('Báo cáo') && nav.includes('Thông báo') && nav.includes('Gói dịch vụ') && nav.includes('Cài đặt'), 'universal navigation items present');
    // Regression: V23 product add flow still works (Acceptance 02).
    await p.goto(base + '#/san-pham'); await p.waitForTimeout(300);
    await p.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
    await p.getByLabel('Mã SKU').fill('AO-01'); await p.getByLabel('Tên sản phẩm').fill('Áo thun'); await p.getByLabel('Giá bán (VND)').fill('199.000');
    await p.getByRole('button', { name: 'Lưu' }).click(); await p.waitForTimeout(300);
    const add = rpcCalls.find(c => c.fn === 'save_merchant_product_in_store');
    ok(add && add.body.p_store === S.A && add.body.p_price === 199000, 'shop: save_merchant_product_in_store payload unchanged (V23 regression)');
    // Draft vs published is explicit.
    await p.goto(base + '#/menu-tro-ly'); await p.waitForTimeout(400);
    ok(await p.getByText('Khách đang thấy: phiên bản 2').count() === 1 && await p.getByText('Đang sửa: bản nháp 3').count() === 1, 'menu: draft is never shown as published (badges)');
    // Acceptance 04: rename + reorder keep action ids.
    await p.getByLabel('Tên nút').first().fill('Xem hàng mới');
    await p.getByRole('button', { name: 'Đưa Xem hàng mới xuống dưới' }).click();
    const prev = await p.locator('.chat-preview .chip', { hasText: 'Xem hàng mới' }).count();
    await p.getByRole('button', { name: 'Lưu nháp' }).click(); await p.waitForTimeout(300);
    const save = rpcCalls.filter(c => c.fn === 'save_assistant_draft').pop();
    const ids = save?.body.p_config.menu.map(m => m.id);
    const renamed = save?.body.p_config.menu.find(m => m.id === 'catalog');
    ok(prev > 0 && save && save.body.p_assistant === 'a-shop' && save.body.p_expected_sha === 'shaA3' && ids.join() === 'order_lookup,catalog,website,handoff'
      && renamed.label === 'Xem hàng mới' && renamed.action_type === 'SHOW_CATALOG' && Object.keys(save.body).sort().join() === 'p_assistant,p_config,p_expected_sha',
      'menu: rename + reorder keep action_id/action_type; payload carries no tenant/store/permission');
    // Channel preview fallback.
    await p.getByRole('tab', { name: 'Telegram' }).click(); await p.waitForTimeout(150);
    ok(await p.locator('.chat-preview .bubble.pre', { hasText: 'Bạn gõ số để chọn' }).count() === 1, 'preview: text-only channel renders numbered fallback');
    await p.getByRole('tab', { name: 'Messenger' }).click(); await p.getByRole('tab', { name: 'Điện thoại' }).click();
    ok(await p.getByText('menu ☰ có thể không hiện').count() >= 1 && await p.getByText('Dự phòng khi kênh không hiện được nút').count() === 1, 'preview: Messenger mobile note + text fallback');
    // Isolation: an assistant id from another tenant in the URL is ignored.
    const before = reads.length;
    await p.goto(base + '#/menu-tro-ly?a=a-artist'); await p.reload(); await p.waitForTimeout(500);
    const leaked = reads.slice(before).some(r => r.q.includes('a-artist'));
    ok(!leaked && await p.getByText('Gió Bấc').count() === 0 && await p.getByText('Khách đang thấy: phiên bản 2').count() === 1, 'isolation: ?a=<other tenant assistant> is ignored, no request for it, own assistant shown');
    ok(reads.filter(r => r.uid === U.shopOwner && ['assistants', 'assistant_config_versions', 'channel_connections', 'products', 'orders', 'customers', 'conversations', 'store_faqs', 'store_bot_settings'].includes(r.table))
      .every(r => r.q.includes('store_id=eq.' + S.A) || r.q.includes('assistant_id=eq.a-shop')
      // V23 Orders page resolves customer names by ids taken from store-filtered orders (RLS still applies).
      || (r.table === 'customers' && /^\?select=id%2Cdisplay_name&id=in\./.test(r.q)) || (console.log('  unfiltered', r.table, r.q), false)), 'isolation: every store-scoped read is filtered by the current store / its assistant');
    // Reaction OFF.
    await p.goto(base + '#/phong-cach'); await p.waitForTimeout(300);
    const sw = p.getByRole('switch', { name: /Biểu cảm tự động/ });
    ok(await sw.getAttribute('aria-checked') === 'false' && await sw.isDisabled(), 'reaction: automatic reactions OFF and cannot be enabled');
    ok(!rpcCalls.some(c => /reaction/i.test(c.fn)), 'reaction: no reaction RPC/provider call');
    // Daily briefing: preferences saved through save_briefing_settings only; nothing is sent.
    await p.goto(base + '#/bao-cao'); await p.waitForTimeout(300);
    ok(await p.locator('td.num', { hasText: '—' }).count() >= 1, 'reports: metrics without verified source show "—"');
    await p.getByLabel('Tôi muốn nhận báo cáo mỗi sáng khi hệ thống gửi sẵn sàng').check();
    await p.getByLabel('Giờ gửi').fill('06:45');
    await p.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click(); await p.waitForTimeout(300);
    const bs = rpcCalls.filter(c => c.fn === 'save_briefing_settings').pop();
    ok(bs && bs.body.p_store === S.A && bs.body.p_opt_in === true && bs.body.p_send_time === '06:45' && bs.body.p_destination === 'email' && Array.isArray(bs.body.p_metrics) && bs.body.p_metrics.includes('orders'),
      'daily briefing: preferences saved via save_briefing_settings for this store');
    ok(await p.getByText('hiện chưa có tin nào được gửi', { exact: false }).count() === 1 && !rpcCalls.some(c => /send|notify|dispatch/i.test(c.fn)), 'daily briefing: says nothing is sent; no send RPC');
    // Channels: real connection read, honest labels.
    await p.goto(base + '#/kenh-ban'); await p.waitForTimeout(300);
    ok(await p.getByText('Fanpage demo Hoa Mai').count() === 1 && await p.getByText('Môi trường demo', { exact: false }).count() >= 1, 'channels: connection status from channel_connections, demo env labelled');
    ok(await p.getByText('Đã tích hợp').count() === 0 && await p.getByText('Sẵn sàng').count() === 0, 'channels: no fake "Đã tích hợp"/"Sẵn sàng" labels');
    await ctx.close(); }

  // 3. Artist workspace (Acceptance 03).
  { const { p, ctx } = await page(1280, 860, U.artistOwner, 'artist@example.com');
    await p.goto(base + '#/'); await p.waitForTimeout(400);
    const nav = await p.locator('nav[aria-label="Menu Workspace"]').innerText();
    ok(nav.includes('Hồ sơ & âm nhạc') && !nav.includes('Sản phẩm & tồn kho') && nav.includes('Người hâm mộ'), 'artist nav: artist module, no product screen, people label');
    await p.goto(base + '#/san-pham'); await p.waitForTimeout(300);
    ok(await p.getByText('chưa bật cho không gian làm việc này', { exact: false }).count() === 1 && !reads.some(r => r.uid === U.artistOwner && r.table === 'products'), 'artist: product route blocked, products never queried');
    await p.goto(base + '#/nghe-si'); await p.waitForTimeout(400);
    await p.getByLabel('Nghệ danh / tên hiển thị').fill('Gió Bấc');
    const music = p.locator('section.slot', { hasText: 'Danh sách phát YouTube' });
    await music.getByLabel('Tên nút khách thấy').fill('Nghe nhạc mới');
    await music.getByLabel('Đường dẫn YouTube').fill('https://www.youtube.com/@giobac');
    await music.getByRole('switch').click();
    await p.locator('section.slot', { hasText: 'Nội dung nổi bật' }).getByRole('button', { name: '+ Thêm vào menu (bản nháp)' }).click();
    await p.locator('section.slot', { hasText: 'Nội dung nổi bật' }).getByLabel('Nội dung').fill('Single mới ra mắt tháng 12.');
    await p.getByRole('button', { name: 'Lưu nháp' }).click(); await p.waitForTimeout(300);
    const s = rpcCalls.filter(c => c.fn === 'save_assistant_draft' && c.uid === U.artistOwner).pop();
    const mu = s?.body.p_config.menu.find(m => m.id === 'music');
    ok(s && s.body.p_assistant === 'a-artist' && s.body.p_expected_sha === 'shaB1' && mu.label === 'Nghe nhạc mới' && mu.enabled === true && mu.action_type === 'SHOW_PLAYLIST'
      && mu.action_config.url === 'https://www.youtube.com/@giobac' && s.body.p_config.profile.display_name === 'Gió Bấc'
      && s.body.p_config.menu.some(m => m.action_type === 'SHOW_CONTENT' && m.action_config.text.startsWith('Single')),
      'artist: music/profile/highlight saved to the assistant DRAFT via save_assistant_draft (id stable)');
    await ctx.close(); }

  // 4. Education workspace: no product screen; module page works.
  { const { p, errs, ctx } = await page(390, 844, U.eduOwner, 'edu@example.com');
    await p.goto(base + '#/khoa-hoc'); await check(p, errs, 'edu-khoa-hoc', '390');
    const nav = await p.locator('nav[aria-label="Menu Workspace"]').innerText();
    ok(nav.includes('Khóa học & tuyển sinh') && !nav.includes('Sản phẩm & tồn kho') && !nav.includes('Đơn hàng'), 'education nav: course module, no product/order screens');
    await ctx.close(); }

  // 5. Staff cannot edit (role from store_memberships).
  { const { p, ctx } = await page(1280, 860, U.staff, 'staff@example.com');
    await p.goto(base + '#/menu-tro-ly'); await p.waitForTimeout(400);
    ok(await p.getByRole('button', { name: 'Lưu nháp' }).count() === 0 && await p.getByRole('button', { name: 'Kích hoạt' }).count() === 0 && await p.getByLabel('Tên nút').first().isDisabled(), 'staff: menu read-only, no save/publish');
    await p.goto(base + '#/tro-ly'); await p.waitForTimeout(300);
    ok(await p.getByRole('button', { name: '+ Tạo trợ lý' }).count() === 0, 'staff: cannot create assistants');
    await p.goto(base + '#/hoi-thoai'); await p.waitForTimeout(300);
    ok(await p.getByText('Chỉ chủ sở hữu và quản lý').count() === 1, 'staff: conversations hidden');
    await p.goto(base + '#/cai-dat-bot'); await p.waitForTimeout(300);
    ok(await p.getByRole('button', { name: 'Lưu hồ sơ ngành' }).count() === 0 && await p.getByLabel('Tên ngành của bạn').isDisabled(), 'staff: cannot change the workspace profile');
    ok(!rpcCalls.some(c => c.uid === U.staff), 'staff: no write RPC issued');
    await ctx.close(); }

  // 5b. Server without V25 settings (db/v25-workspace not applied): honest fallbacks, no crash.
  { const { p, errs, ctx } = await page(390, 844, U.shopOwner, 'shop@example.com', ['store_briefing_settings', 'workspace_profiles', 'save_workspace_profile']);
    await p.goto(base + '#/bao-cao'); await p.waitForTimeout(400);
    ok(await p.getByRole('button', { name: 'Lưu cài đặt (chưa mở)' }).isDisabled(), 'briefing (server not updated): save disabled, labelled not open');
    await p.goto(base + '#/cai-dat-bot'); await p.waitForTimeout(300);
    ok(await p.getByText('Máy chủ chưa hỗ trợ lưu hồ sơ ngành', { exact: false }).count() === 1 && await p.getByRole('button', { name: 'Lưu hồ sơ ngành' }).isDisabled(), 'profile (server not updated): says so, save disabled, App still infers industry');
    await check(p, errs.filter(e => !/404|Failed to load resource/.test(e)), 'shop-cai-dat-missing', '390');
    await ctx.close(); }

  // 5c. Flexible industry: owner turns the shop into a dental clinic that also runs courses (runs last: changes the mock).
  { const { p, errs, ctx } = await page(1280, 860, U.shopOwner, 'shop@example.com');
    await p.goto(base + '#/cai-dat-bot'); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /Phòng khám \/ nha khoa/ }).click();
    await p.getByLabel('Tên ngành của bạn').fill('Nha khoa Hoa Mai');
    await p.getByRole('checkbox', { name: /Khóa học & tuyển sinh/ }).check();
    await p.getByRole('button', { name: 'Lưu hồ sơ ngành' }).click(); await p.waitForTimeout(500);
    const wp = rpcCalls.filter(c => c.fn === 'save_workspace_profile').pop();
    ok(wp && wp.body.p_store === S.A && wp.body.p_label === 'Nha khoa Hoa Mai' && wp.body.p_people_label === 'Bệnh nhân' && [...wp.body.p_modules].sort().join() === 'education,service',
      'profile: free industry name + any module mix + own customer word saved via save_workspace_profile (store-scoped)');
    const nav = await p.locator('nav[aria-label="Menu Workspace"]').innerText();
    ok(nav.includes('Dịch vụ & lịch hẹn') && nav.includes('Khóa học & tuyển sinh') && !nav.includes('Sản phẩm & tồn kho') && nav.includes('Bệnh nhân'), 'profile: nav follows the saved modules and customer word');
    ok((await p.locator('.topbar, header').first().innerText().catch(() => '')).includes('Nha khoa Hoa Mai') || await p.getByText('Nha khoa Hoa Mai').count() >= 1, 'profile: owner industry name shown');
    await p.goto(base + '#/khach-hang'); await check(p, errs, 'profile-khach-hang', '1280');
    ok((await p.locator('h1').first().textContent()).trim() === 'Bệnh nhân', 'profile: customers page uses the owner word');
    await p.goto(base + '#/dich-vu'); await check(p, errs, 'profile-dich-vu', '1280');
    await ctx.close(); }

  // 6. No credentials in the shipped bundle.
  const bundle = fs.readdirSync(path.join(ROOT, 'app', 'assets')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'app', 'assets', f), 'utf8')).join('\n');
  ok(!/sb_secret_|service_role|eyJhbGciOi/.test(bundle), 'bundle: no secret key / service_role / JWT');

  await b.close(); server.close();
  console.log(bad ? `T404_V25_WORKSPACE_UI_FAIL ${bad}` : 'T404_V25_WORKSPACE_UI_PASS');
  process.exit(bad ? 1 : 0);
})();
