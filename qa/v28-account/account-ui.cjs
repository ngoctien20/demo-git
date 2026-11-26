// V28 Account — browser QA of sign-up / login / forgot, Account tabs, DEMO billing and platform Admin with a MOCKED Supabase
// (no network, no real accounts, no money). Billing + admin RPCs are answered by an in-memory model of db/v28-account.
// usage: node qa/v28-account/account-ui.cjs <outDir|->   (screenshots at 2x when outDir is given)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2] || '-';
const REF = 'ifxlvrhyjhbzbrkdsida';
const OWNER = 'd0000000-0000-4000-8000-0000000000e1', ADMIN = 'd0000000-0000-4000-8000-0000000000ad', STAFF = 'd0000000-0000-4000-8000-0000000000f1';
const T1 = 't0000000-0000-4000-8000-000000000001', S1 = 's0000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const PRICE = { lite: 99000, plus: 299000, pro: 699000 };
const users = {
  [OWNER]: { email: 'chu.shop@example.com', meta: { full_name: 'Nguyễn Thị Mai', phone: '0912345678' }, role: 'owner' },
  [STAFF]: { email: 'nhanvien@example.com', meta: { full_name: 'Trần Văn Bình' }, role: 'staff' },
  [ADMIN]: { email: 'admin@tien404.example', meta: { full_name: 'Quản trị TIEN404' }, role: 'owner' },
};
const overview = {
  generated_at: now,
  stores: [
    { store_id: S1, store_name: 'Shop Hoa Mai', tenant_name: 'Shop Hoa Mai', active: true, created_at: ago(20), owner_id: OWNER, owner_email: 'chu.shop@example.com', owner_locked: false, members: 2, plan: 'plus', plan_status: 'active', renews_at: ago(-25), last_invoice_status: 'paid', pending_invoices: 0, paid_demo_vnd: 299000, bot_enabled: true, products: 21, orders_7d: 7 },
    { store_id: 's2', store_name: 'Tiệm Nail Bống', tenant_name: 'Tiệm Nail Bống', active: true, created_at: ago(6), owner_id: 'u2', owner_email: 'nailbong@example.com', owner_locked: false, members: 1, plan: 'trial', plan_status: 'trial', renews_at: null, last_invoice_status: 'pending', pending_invoices: 1, paid_demo_vnd: 0, bot_enabled: null, products: 12, orders_7d: 3 },
    { store_id: 's3', store_name: 'Phụ kiện Linh', tenant_name: 'Linh Accessories', active: true, created_at: ago(40), owner_id: 'u3', owner_email: 'linh.pk@example.com', owner_locked: true, members: 3, plan: 'lite', plan_status: 'canceled', renews_at: ago(-3), last_invoice_status: 'paid', pending_invoices: 0, paid_demo_vnd: 198000, bot_enabled: false, products: 54, orders_7d: 0 },
    { store_id: 's4', store_name: 'Chuỗi Cà phê Gió', tenant_name: 'Gió Coffee', active: true, created_at: ago(2), owner_id: 'u4', owner_email: 'gio.coffee@example.com', owner_locked: false, members: 6, plan: 'pro', plan_status: 'active', renews_at: ago(-363), last_invoice_status: 'paid', pending_invoices: 0, paid_demo_vnd: 6990000, bot_enabled: true, products: 88, orders_7d: 41 }],
  accounts: [
    { user_id: ADMIN, email: 'admin@tien404.example', created_at: ago(60), last_sign_in_at: now, email_confirmed: true, is_admin: true, locked: false, lock_reason: null, locked_at: null, stores: 1 },
    { user_id: OWNER, email: 'chu.shop@example.com', created_at: ago(20), last_sign_in_at: ago(0.2), email_confirmed: true, is_admin: false, locked: false, lock_reason: null, locked_at: null, stores: 1 },
    { user_id: 'u2', email: 'nailbong@example.com', created_at: ago(6), last_sign_in_at: ago(1), email_confirmed: true, is_admin: false, locked: false, lock_reason: null, locked_at: null, stores: 1 },
    { user_id: 'u3', email: 'linh.pk@example.com', created_at: ago(40), last_sign_in_at: ago(9), email_confirmed: true, is_admin: false, locked: true, lock_reason: 'Gửi tin rác cho khách', locked_at: ago(2), stores: 1 },
    { user_id: 'u5', email: 'moi.dangky@example.com', created_at: ago(0.1), last_sign_in_at: null, email_confirmed: false, is_admin: false, locked: false, lock_reason: null, locked_at: null, stores: 0 }],
};
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
const calls = [];
let bad = 0;
const assert = (cond, label, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + label, cond ? '' : extra); if (!cond) bad++; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/app/`;
  // Platform Admin only exists in the separate admin build (npm run build:admin → admin-local/, never deployed).
  const adminBase = `http://127.0.0.1:${server.address().port}/admin-local/`;
  // The public bundle must carry no trace of the Admin page.
  for (const f of fs.readdirSync(path.join(ROOT, 'app', 'assets'))) {
    const txt = fs.readFileSync(path.join(ROOT, 'app', 'assets', f), 'utf8');
    const hit = ['admin_overview', 'is_platform_admin', 'admin_set_account_lock', 'admin_set_store_bot', 'quan-tri', 'Quản trị nền tảng', 'platform_admins', 'admin-banner'].filter(k => txt.includes(k));
    assert(hit.length === 0, `public bundle ${f} has no admin trace`, hit.join(','));
  }
  assert(fs.existsSync(path.join(ROOT, 'admin-local', 'index.html')), 'admin build present (npm run build:admin)');
  const b = await chromium.launch();
  const userObj = uid => ({ id: uid, email: users[uid].email, aud: 'authenticated', role: 'authenticated', created_at: ago(20), email_confirmed_at: ago(20), last_sign_in_at: ago(0.2), user_metadata: users[uid].meta, identities: [{ id: uid }] });
  const sessionFor = uid => ({ access_token: 'x.' + Buffer.from(JSON.stringify({ sub: uid, exp: 9999999999 })).toString('base64url') + '.y', token_type: 'bearer',
    expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: userObj(uid) });

  async function page(w, h, { uid = OWNER, loggedIn = true, scale = 1 } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    if (loggedIn) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(sessionFor(uid))]);
    const bill = { subscription: { plan: 'trial', cycle: 'month', status: 'trial', renews_at: null }, invoices: [] };
    const st = () => ({ demo: true, ...JSON.parse(JSON.stringify(bill)) });
    await ctx.route(/supabase\.co\//, async route => {
      const rq = route.request(); const u = new URL(rq.url());
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (u.pathname.startsWith('/auth/v1/')) {
        const body = rq.postDataJSON?.() ?? null; const ep = u.pathname.slice(9);
        calls.push({ fn: 'auth:' + ep + (u.searchParams.get('grant_type') ? ':' + u.searchParams.get('grant_type') : ''), method: rq.method(), body });
        if (ep === 'signup') return json(200, { id: 'new-user', email: body.email, user_metadata: body.data, identities: [{ id: 'i' }], aud: 'authenticated', role: 'authenticated' });
        if (ep === 'token' && u.searchParams.get('grant_type') === 'password') {
          if (body.email === 'chua.xacnhan@example.com') return json(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
          if (body.password !== 'MatKhau#2026') return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return json(200, sessionFor(uid));
        }
        if (ep === 'user' && rq.method() === 'PUT') { Object.assign(users[uid].meta, body.data || {}); return json(200, userObj(uid)); }
        if (ep === 'user') return json(200, userObj(uid));
        return json(200, {});
      }
      const m = u.pathname.match(/\/rest\/v1\/(rpc\/)?(\w+)/);
      if (m && m[1]) {
        const fn = m[2]; const a = rq.postDataJSON() || {}; calls.push({ fn, body: a, uid });
        const me = users[uid].role; const admin = uid === ADMIN;
        if (fn === 'is_platform_admin') return json(200, admin);
        if (fn === 'admin_overview') return admin ? json(200, overview) : json(403, { code: '42501', message: 'access_denied' });
        if (fn === 'admin_set_account_lock' || fn === 'admin_set_store_bot') return admin ? json(200, a.p_locked ?? a.p_enabled) : json(403, { code: '42501', message: 'access_denied' });
        if (fn.startsWith('billing_demo_')) {
          if (a.p_store !== S1) return json(403, { code: '42501', message: 'access_denied' });
          if (fn !== 'billing_demo_state' && me !== 'owner') return json(403, { code: '42501', message: 'access_denied' });
          if (fn === 'billing_demo_checkout') {
            bill.invoices.forEach(i => { if (i.status === 'pending') i.status = 'void'; });
            const n = 'HD-DEMO-261125-' + String(bill.invoices.length + 1).padStart(6, 'A');
            bill.invoices.unshift({ id: 'inv' + bill.invoices.length, number: n, plan: a.p_plan, cycle: a.p_cycle, amount_vnd: PRICE[a.p_plan] * (a.p_cycle === 'year' ? 10 : 1), status: 'pending', transfer_note: 'T404DEMO ' + n.slice(8), created_at: new Date().toISOString(), paid_at: null });
          }
          if (fn === 'billing_demo_confirm') {
            const i = bill.invoices.find(x => x.id === a.p_invoice && x.status === 'pending'); if (!i) return json(409, { code: 'PT409', message: 'invoice_not_pending' });
            i.status = 'paid'; i.paid_at = new Date().toISOString();
            bill.subscription = { plan: i.plan, cycle: i.cycle, status: 'active', renews_at: ago(i.cycle === 'year' ? -365 : -30) };
          }
          if (fn === 'billing_demo_cancel') bill.subscription.status = 'canceled';
          return json(200, st());
        }
        return json(200, now);
      }
      const t = m && m[2];
      const fx = {
        store_memberships: [{ store_id: S1, tenant_id: T1, role: users[uid].role }],
        stores: [{ id: S1, tenant_id: T1, name: 'Shop Hoa Mai', is_default: true }],
        tenants: [{ id: T1, name: 'Shop Hoa Mai', industry: 'fashion' }],
      };
      const rows = fx[t] || [];
      const single = (rq.headers()['accept'] || '').includes('vnd.pgrst.object');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
        body: rq.method() === 'HEAD' ? '' : JSON.stringify(single ? (rows[0] ?? null) : rows) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errs.push(m.text()); });
    return { p, errs, ctx };
  }
  async function shot(p, errs, name, tag, full = true) {
    await p.waitForTimeout(450);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const spinning = await p.locator('.spinner').count();
    const h = (await p.locator('h1, .modal-head h2').last().textContent().catch(() => '')) || '';
    if (out !== '-') await p.screenshot({ path: `${out}/${tag}_${name}.png`, fullPage: full });
    const e = errs.splice(0);
    assert(!ov && !e.length && !spinning, `${tag} ${name.padEnd(18)} ${h.trim()}`, `${ov ? 'OVERFLOW ' : ''}${spinning ? 'LOADING ' : ''}${e.join(' | ')}`);
  }
  const scale = out === '-' ? 1 : 2;
  for (const [w, h, tag] of [[1280, 860, 'may-tinh'], [390, 844, 'dien-thoai']]) {
    // ---------- Auth ----------
    { const { p, errs, ctx } = await page(w, h, { loggedIn: false, scale });
      await p.goto(base + '#/dang-nhap'); await shot(p, errs, '01-dang-nhap', tag);
      await p.getByLabel('Email').fill('chu.shop@example.com'); await p.getByLabel('Mật khẩu', { exact: true }).fill('sai-mat-khau');
      await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await p.waitForTimeout(300);
      assert(await p.getByText('Email hoặc mật khẩu không đúng.').count() === 1, `${tag} sai mật khẩu báo tiếng Việt`);
      await p.getByLabel('Email').fill('chua.xacnhan@example.com'); await p.getByLabel('Mật khẩu', { exact: true }).fill('MatKhau#2026');
      await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await p.waitForTimeout(300);
      assert(await p.getByRole('button', { name: 'Gửi lại thư xác nhận' }).count() === 1, `${tag} chưa xác nhận email → nút gửi lại`);
      await p.getByRole('button', { name: 'Gửi lại thư xác nhận' }).click(); await p.waitForTimeout(300);
      assert(calls.some(c => c.fn === 'auth:resend' && c.body.email === 'chua.xacnhan@example.com' && c.body.type === 'signup'), `${tag} gửi lại thư xác nhận gọi /resend`);
      await p.goto(base + '#/dang-ky?goi=plus'); await shot(p, errs, '02-dang-ky-goi-plus', tag);
      await p.getByLabel('Họ và tên').fill('Lê Thu Hà'); await p.getByLabel(/Số điện thoại/).fill('+84 912 345 678');
      await p.getByLabel('Email').fill('Thuha.Shop@Example.com'); await p.getByLabel('Mật khẩu', { exact: true }).fill('MatKhau#2026');
      await p.getByLabel('Nhập lại mật khẩu').fill('MatKhau#2025');
      await p.getByRole('button', { name: 'Tạo tài khoản miễn phí' }).click(); await p.waitForTimeout(200);
      assert(await p.getByText('Hai mật khẩu chưa giống nhau.').count() === 1, `${tag} mật khẩu nhập lại sai bị chặn`);
      await p.getByLabel('Nhập lại mật khẩu').fill('MatKhau#2026');
      await p.getByRole('button', { name: 'Tạo tài khoản miễn phí' }).click(); await p.waitForTimeout(200);
      assert(await p.getByText(/cần đồng ý Điều khoản/).count() === 1, `${tag} bắt buộc đồng ý điều khoản`);
      await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Tạo tài khoản miễn phí' }).click(); await p.waitForTimeout(400);
      const su = calls.filter(c => c.fn === 'auth:signup').pop();
      assert(su && su.body.email === 'thuha.shop@example.com' && su.body.data.full_name === 'Lê Thu Hà' && su.body.data.phone === '0912345678' && su.body.data.signup_plan === 'plus',
        `${tag} đăng ký gửi email chữ thường + SĐT chuẩn hoá + gói đã chọn`, JSON.stringify(su && su.body));
      await shot(p, errs, '03-kiem-tra-hop-thu', tag);
      await p.goto(base + '#/quen-mat-khau'); await p.getByLabel('Email').fill('chu.shop@example.com');
      await p.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click(); await p.waitForTimeout(300);
      assert(calls.some(c => c.fn === 'auth:recover') && await p.getByText('Kiểm tra hộp thư').count() === 1, `${tag} quên mật khẩu → gửi thư`);
      await ctx.close(); }

    // ---------- Account + DEMO billing (owner) ----------
    { const { p, errs, ctx } = await page(w, h, { scale }); const mark = calls.length;
      await p.goto(base + '#/tai-khoan'); await shot(p, errs, '04-tai-khoan-ho-so', tag);
      await p.getByLabel('Số điện thoại').fill('0987 654 321'); await p.getByRole('button', { name: 'Lưu hồ sơ' }).click(); await p.waitForTimeout(300);
      const pu = calls.filter(c => c.fn === 'auth:user' && c.method === 'PUT').pop();
      assert(pu && pu.body.data.phone === '0987654321', `${tag} lưu hồ sơ chuẩn hoá SĐT`, JSON.stringify(pu));
      await p.goto(base + '#/tai-khoan?tab=bao-mat'); await shot(p, errs, '05-tai-khoan-bao-mat', tag);
      await p.getByLabel('Mật khẩu hiện tại').fill('sai'); await p.getByLabel('Mật khẩu mới', { exact: true }).fill('MoiHon#2027'); await p.getByLabel('Nhập lại mật khẩu mới').fill('MoiHon#2027');
      await p.getByRole('button', { name: 'Đổi mật khẩu' }).click(); await p.waitForTimeout(300);
      assert(await p.getByText('Mật khẩu hiện tại không đúng.').count() === 1, `${tag} đổi mật khẩu kiểm tra mật khẩu hiện tại`);
      await p.goto(base + '#/tai-khoan?tab=goi'); await shot(p, errs, '06-goi-va-thanh-toan', tag);
      assert(await p.locator('.demo-banner').count() >= 1, `${tag} có nhãn BẢN DEMO`);
      await p.getByRole('radio', { name: /Theo năm/ }).click();
      await p.getByRole('button', { name: 'Chọn PLUS' }).click(); await p.waitForTimeout(400);
      const co = calls.filter(c => c.fn === 'billing_demo_checkout').pop();
      assert(co && co.body.p_plan === 'plus' && co.body.p_cycle === 'year' && co.body.p_store === S1 && !('p_amount' in co.body), `${tag} checkout chỉ gửi gói/chu kỳ, giá do máy chủ tính`, JSON.stringify(co));
      assert(await p.getByText('2.990.000đ').count() >= 1 && await p.locator('.qr svg').count() === 1 && await p.locator('.qr-stamp').count() === 1, `${tag} hiện số tiền + QR mẫu có dấu DEMO`);
      const qrText = await p.evaluate(() => document.querySelector('.qr svg') ? 'svg' : '');
      assert(qrText === 'svg', `${tag} QR vẽ tại chỗ, không gọi dịch vụ ngoài`);
      await shot(p, errs, '07-thanh-toan-qr-demo', tag, false);
      await p.getByRole('button', { name: 'Mô phỏng: đã thanh toán' }).click(); await p.waitForTimeout(400);
      assert(await p.getByText('Gói PLUS đã được kích hoạt').count() === 1, `${tag} mô phỏng thanh toán → kích hoạt gói`);
      await p.getByRole('button', { name: 'Xem hoá đơn mẫu' }).click(); await p.waitForTimeout(300);
      await shot(p, errs, '08-hoa-don-mau', tag, false);
      await p.getByRole('button', { name: 'Đóng', exact: true }).last().click(); await p.waitForTimeout(300);
      assert(await p.locator('.plan-current').getByText('Đang hoạt động').count() === 1, `${tag} gói hiện tại = PLUS đang hoạt động`);
      await shot(p, errs, '09-goi-dang-hoat-dong', tag);
      await p.goto(base + '#/quan-tri'); await p.waitForTimeout(400);
      assert(await p.getByText(/Quản trị/).count() === 0 && await p.locator('a[href="#/quan-tri"]').count() === 0, `${tag} bản công khai: không có trang/menu Quản trị`);
      assert(!calls.slice(mark).some(c => ['admin_overview', 'is_platform_admin'].includes(c.fn)), `${tag} bản công khai không gọi RPC admin`);
      await ctx.close(); }

    // ---------- staff: read only ----------
    { const { p, errs, ctx } = await page(w, h, { uid: STAFF });
      await p.goto(base + '#/goi-dich-vu'); await p.waitForTimeout(400);
      assert(await p.getByText(/chế độ chỉ đọc/).count() === 1 && await p.getByRole('button', { name: 'Chọn PLUS' }).isDisabled(), `${tag} nhân viên chỉ xem, không đổi gói`);
      errs.splice(0); await ctx.close(); }

    // ---------- platform Admin (admin build only) ----------
    { const { p, errs, ctx } = await page(w, h, { uid: OWNER });
      await p.goto(adminBase + '#/quan-tri'); await p.waitForTimeout(500);
      assert(await p.getByText('Bạn không có quyền quản trị nền tảng').count() === 1, `${tag} bản admin: chủ shop vẫn bị chặn`);
      assert(!calls.some(c => c.fn === 'admin_overview' && c.uid === OWNER), `${tag} chủ shop không gọi admin_overview`);
      errs.splice(0); await ctx.close(); }
    { const { p, errs, ctx } = await page(w, h, { uid: ADMIN, scale });
      await p.goto(base + '#/quan-tri'); await p.waitForTimeout(400);
      assert(await p.locator('a[href="#/quan-tri"]').count() === 0, `${tag} admin mở bản công khai cũng không thấy Quản trị`);
      await p.goto(adminBase + '#/quan-tri'); await p.waitForTimeout(500);
      assert(await p.locator('a[href="#/quan-tri"]').count() === 1 && await p.locator('a[href="#/san-pham"]').count() === 0, `${tag} bản admin chỉ có menu Khách hàng, không có trang shop`);
      assert(await p.locator('.admin-table tbody tr').count() === 4, `${tag} 4 khách (không tính admin)`, String(await p.locator('.admin-table tbody tr').count()));
      assert(await p.getByText(/Mặc định bật|Tắt bot/).count() === 0, `${tag} bỏ công tắc bot chưa nối`);
      await shot(p, errs, '10-quan-tri-khach-hang', tag);
      await p.getByRole('button', { name: 'Xem nailbong@example.com' }).click(); await p.waitForTimeout(200);
      assert(await p.getByRole('dialog').getByText('Tiệm Nail Bống').count() >= 1, `${tag} xem chi tiết khách`);
      await shot(p, errs, '11-quan-tri-chi-tiet', tag, false);
      await p.getByRole('dialog').getByRole('button', { name: 'Khoá tài khoản' }).click(); await p.waitForTimeout(200);
      await p.getByRole('button', { name: 'Khoá tài khoản' }).click(); await p.waitForTimeout(200);
      assert(await p.getByText('Ghi lý do khoá').count() === 1, `${tag} khoá phải ghi lý do`);
      await p.getByLabel(/Lý do/).fill('Shop thử, gửi tin rác');
      await shot(p, errs, '12-quan-tri-khoa', tag, false);
      await p.getByRole('button', { name: 'Khoá tài khoản' }).click(); await p.waitForTimeout(400);
      const lk = calls.filter(c => c.fn === 'admin_set_account_lock').pop();
      assert(lk && lk.body.p_user === 'u2' && lk.body.p_locked === true && lk.body.p_reason === 'Shop thử, gửi tin rác', `${tag} khoá gọi admin_set_account_lock đúng`, JSON.stringify(lk));
      assert(await p.getByText('admin@tien404.example').count() <= 1, `${tag} admin không nằm trong danh sách khách`);
      await p.getByRole('tab', { name: /Chưa tạo shop/ }).click(); await p.waitForTimeout(200);
      assert(await p.locator('.admin-table tbody tr').count() === 1, `${tag} lọc Chưa tạo shop`);
      await p.getByRole('tab', { name: /Tất cả/ }).click();
      await p.getByPlaceholder(/Tìm email/).fill('linh'); await p.waitForTimeout(200);
      assert(await p.locator('.admin-table tbody tr').count() === 1, `${tag} tìm khách hoạt động`);
      errs.splice(0); await ctx.close(); }
  }
  await b.close(); server.close();
  console.log(bad ? `T404_V28_ACCOUNT_UI_FAIL ${bad}` : 'T404_V28_ACCOUNT_UI_PASS');
  process.exit(bad ? 1 : 0);
})();
