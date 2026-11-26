// Platform Admin (TIEN404 staff only, admin build only). Access is decided by the SERVER: public.is_platform_admin() and
// every admin_* RPC re-check app_private.platform_admins. Hiding the menu is only cosmetic.
// Sections: Tổng quan · Khách hàng · Gói & giá · Hoá đơn · Cài đặt. Payments are still DEMO (no money moves).
import { useMemo, useState } from 'react';
import { SITE_HOME } from '../config';
import { supabase, friendlyError } from '../supabase';
import { isMissingFeature, useLoad } from '../data';
import { dateTime, vnd } from '../format';
import { useRoute } from '../router';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';
import { PLANS, PlanKey } from '../billing';
import './admin.css';

const ADMIN_ERRORS: Record<string, string> = {
  cannot_lock_self: 'Bạn không thể tự khoá tài khoản của mình.',
  cannot_lock_admin: 'Không thể khoá tài khoản quản trị viên khác.',
  invalid_reason: 'Lý do khoá cần từ 3 đến 300 ký tự.',
  invalid_account: 'Không tìm thấy tài khoản này.',
  invalid_price: 'Giá hoặc tên gói chưa hợp lệ. Giá là số tròn nghìn, tối đa 5.000.000đ/tháng; tên 1–20 ký tự.',
  invalid_features: 'Mỗi tính năng 1–120 ký tự, tối đa 12 dòng.',
  last_visible_plan: 'Phải còn ít nhất 1 gói hiện cho khách.',
  invalid_settings: 'Thông tin chưa hợp lệ: Zalo/SĐT chỉ gồm số, email phải đúng dạng, thông báo tối đa 300 ký tự.',
  invoice_not_pending: 'Hoá đơn này không còn ở trạng thái chờ thanh toán.',
  invalid_until: 'Ngày hết hạn phải sau hôm nay và không quá 3 năm.',
  invalid_plan: 'Gói không hợp lệ.',
};
const adminError = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e);
  for (const [k, v] of Object.entries(ADMIN_ERRORS)) if (m.includes(k)) return v;
  return friendlyError(e);
};
const NEEDS_SQL = 'Máy chủ chưa có phần này. Cần áp db/v28-account/20 lên Supabase (em sẽ hỏi anh trước khi áp).';

export type AdminStore = {
  store_id: string; store_name: string; tenant_name: string; active: boolean; created_at: string;
  owner_id: string | null; owner_email: string | null; owner_locked: boolean; members: number;
  plan: 'trial' | PlanKey; plan_status: 'trial' | 'active' | 'canceled'; renews_at: string | null;
  last_invoice_status: 'pending' | 'paid' | 'void' | null; pending_invoices: number; paid_demo_vnd: number;
  bot_enabled: boolean | null; products: number; orders_7d: number;
};
export type AdminAccount = {
  user_id: string; email: string; created_at: string | null; last_sign_in_at: string | null; email_confirmed: boolean;
  is_admin: boolean; locked: boolean; lock_reason: string | null; locked_at: string | null; stores: number;
};
type Overview = { generated_at: string; stores: AdminStore[]; accounts: AdminAccount[] };
type AdminInvoice = { id: string; number: string; store_id: string; store_name: string; owner_email: string | null; plan: PlanKey; cycle: 'month' | 'year';
  amount_vnd: number; status: 'pending' | 'paid' | 'void'; transfer_note: string; created_at: string; paid_at: string | null };
type ServerPlan = { key: PlanKey; name: string; month_vnd: number; year_months: number; tagline: string; who: string; features: string[]; best: boolean; visible: boolean; updated_at: string };
type Settings = { notice: string; support_zalo: string; support_phone: string; support_email: string; updated_at?: string };
type Config = { plans: ServerPlan[]; settings: Settings; admins: { email: string; note: string | null; added_at: string }[] };

const PLAN_STATUS: Record<string, [string, string]> = { trial: ['Dùng thử', 'soft'], active: ['Đang hoạt động', 'ok'], canceled: ['Huỷ gia hạn', 'warn'] };
const INV: Record<string, [string, string]> = { pending: ['Chờ thanh toán', 'warn'], paid: ['Đã nhận tiền (DEMO)', 'ok'], void: ['Đã huỷ', 'soft'] };
const planLabel = (p: string | null | undefined) => !p ? '—' : p === 'trial' ? 'Dùng thử' : (PLANS[p as PlanKey]?.name ?? p.toUpperCase());

type Customer = AdminAccount & { shops: AdminStore[]; plan: AdminStore['plan'] | null; planStatus: AdminStore['plan_status'] | null; pending: number };
type Filter = 'all' | 'trial' | 'paid' | 'pending' | 'noshop' | 'locked';
const FILTERS: [Filter, string][] = [['all', 'Tất cả'], ['paid', 'Đang dùng gói'], ['trial', 'Dùng thử'], ['pending', 'Chờ thanh toán'], ['noshop', 'Chưa tạo shop'], ['locked', 'Đã khoá']];
const match = (c: Customer, f: Filter) =>
  f === 'all' ? true : f === 'paid' ? c.planStatus === 'active' && c.plan !== 'trial' : f === 'trial' ? c.shops.length > 0 && (c.plan === 'trial' || c.planStatus === 'trial')
    : f === 'pending' ? c.pending > 0 : f === 'noshop' ? c.shops.length === 0 : c.locked;
function customers(d: Overview | null): Customer[] {
  return (d?.accounts ?? []).filter(a => !a.is_admin).map(a => {
    const shops = (d?.stores ?? []).filter(s => s.owner_id === a.user_id);
    const main = shops.find(s => s.plan_status === 'active') ?? shops[0];
    return { ...a, shops, plan: main?.plan ?? null, planStatus: main?.plan_status ?? null, pending: shops.reduce((n, s) => n + s.pending_invoices, 0) };
  }).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
}
const daysAgo = (s: string | null, n: number) => !!s && Date.now() - new Date(s).getTime() < n * 864e5;
const sameMonth = (s: string | null) => { if (!s) return false; const a = new Date(s), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); };

// ---------------- layout ----------------
const NAV: [string, string, string][] = [
  ['/quan-tri', 'Tổng quan', '◎'], ['/quan-tri/khach-hang', 'Khách hàng', '♧'], ['/quan-tri/goi', 'Gói & giá', '◈'],
  ['/quan-tri/hoa-don', 'Hoá đơn', '▤'], ['/quan-tri/cai-dat', 'Cài đặt', '⚙'],
];

/** Whole admin app (admin build only): its own layout, no shop pages. */
export function AdminApp({ email }: { email: string }) {
  const route = useRoute();
  const adm = useLoad(async () => {
    const r = await supabase.rpc('is_platform_admin', {}, { get: true });
    return !r.error && r.data === true;
  }, []);
  const ov = useLoad(async () => {
    if (!adm.data) return null;
    const r = await supabase.rpc('admin_overview');
    if (r.error) throw r.error;
    return r.data as Overview;
  }, [adm.data]);
  const [open, setOpen] = useState(false);
  const path = NAV.some(n => n[0] === route.path) ? route.path : '/quan-tri';
  const isAdmin = adm.loading ? null : adm.data === true;

  const page = (() => {
    if (isAdmin === null) return <Spinner />;
    if (!isAdmin) return (<><PageHead title="Quản trị nền tảng" /><Notice kind="err">Bạn không có quyền quản trị nền tảng. Trang này chỉ dành cho đội TIEN404.</Notice></>);
    if (path === '/quan-tri/goi') return <Plans />;
    if (path === '/quan-tri/cai-dat') return <SettingsPage />;
    if (path === '/quan-tri/hoa-don') return <Invoices onChange={ov.reload} />;
    if (ov.loading && !ov.data) return <Spinner label="Đang tải dữ liệu quản trị…" />;
    if (ov.error || !ov.data) return <Notice kind="err">{isMissingFeature(ov.error) ? 'Máy chủ chưa bật phần Quản trị (db/v28-account chưa áp).' : friendlyError(ov.error)}</Notice>;
    if (path === '/quan-tri/khach-hang') return <Customers d={ov.data} reload={ov.reload} loading={ov.loading} />;
    return <Dashboard d={ov.data} />;
  })();

  return (
    <div className={`shell admin-shell${open ? ' nav-open' : ''}`}>
      <header className="mobile-bar">
        <button type="button" className="icon-btn" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} aria-controls="admin-side" onClick={() => setOpen(!open)}>☰</button>
        <b>TIEN404 Quản trị</b>
      </header>
      <aside className="side" id="admin-side" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <a className="side-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b><small>Quản trị</small></a>
        {isAdmin && <nav aria-label="Menu quản trị">
          <div className="nav-group"><p>Quản trị nền tảng</p>
            {NAV.map(([href, label, icon]) => <a key={href} href={`#${href}`} aria-current={path === href ? 'page' : undefined}><span aria-hidden="true">{icon}</span>{label}</a>)}
          </div>
        </nav>}
        <div className="side-foot">
          <span className="muted" title={email}>{email}</span>
          <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="content" id="main">{page}</main>
    </div>
  );
}

// ---------------- Tổng quan ----------------
function Dashboard({ d }: { d: Overview }) {
  const all = useMemo(() => customers(d), [d]);
  const inv = useLoad(async () => {
    const r = await supabase.rpc('admin_invoices', { p_status: null });
    if (r.error) { if (isMissingFeature(r.error)) return null; throw r.error; }
    return r.data as AdminInvoice[];
  }, []);
  const stores = d.stores;
  const byPlan = (['trial', 'lite', 'plus', 'pro'] as const).map(p => [p, stores.filter(s => (s.plan_status === 'active' || p === 'trial') && (p === 'trial' ? s.plan === 'trial' || s.plan_status !== 'active' : s.plan === p)).length] as const);
  const maxBar = Math.max(1, ...byPlan.map(b => b[1]));
  const monthVnd = inv.data ? inv.data.filter(i => i.status === 'paid' && sameMonth(i.paid_at)).reduce((n, i) => n + i.amount_vnd, 0) : null;
  const pendingInv = inv.data ? inv.data.filter(i => i.status === 'pending') : null;
  const k = {
    customers: all.length, new7: all.filter(c => daysAgo(c.created_at, 7)).length,
    paid: all.filter(c => match(c, 'paid')).length, pending: all.filter(c => match(c, 'pending')).length,
    locked: all.filter(c => c.locked).length, active7: all.filter(c => daysAgo(c.last_sign_in_at, 7)).length,
  };
  return (
    <>
      <PageHead title="Tổng quan" sub={`Tình hình TIEN404 · cập nhật ${dateTime(d.generated_at)}`} />
      <div className="kpis admin-kpis">
        <div className="kpi"><span>Khách hàng</span><b>{k.customers}</b><small>+{k.new7} trong 7 ngày</small></div>
        <div className="kpi"><span>Đang dùng gói</span><b>{k.paid}</b><small>LITE / PLUS / PRO</small></div>
        <div className="kpi"><span>Thu tháng này</span><b>{monthVnd == null ? '—' : vnd(monthVnd)}</b><small>Bản DEMO, chưa phải tiền thật</small></div>
        <div className="kpi"><span>Chờ thanh toán</span><b>{k.pending}</b><small>Khách có hoá đơn chưa trả</small></div>
        <div className="kpi"><span>Hoạt động 7 ngày</span><b>{k.active7}</b><small>Khách có đăng nhập</small></div>
        <div className="kpi"><span>Đã khoá</span><b>{k.locked}</b><small>Không đăng nhập được</small></div>
      </div>
      <div className="admin-grid">
        <section className="panel">
          <h2>Shop theo gói</h2>
          <div className="admin-bars">{byPlan.map(([p, n]) => (
            <div key={p} className="admin-bar"><span>{planLabel(p)}</span><div><i style={{ width: `${(n / maxBar) * 100}%` }} /></div><b>{n}</b></div>
          ))}</div>
        </section>
        <section className="panel">
          <h2>Việc cần làm</h2>
          {pendingInv == null ? <p className="muted">{inv.loading ? 'Đang tải…' : NEEDS_SQL}</p> : pendingInv.length === 0 ? <p className="muted">Không có hoá đơn nào chờ xác nhận.</p> : (
            <ul className="admin-list">{pendingInv.slice(0, 5).map(i => (
              <li key={i.id}><span><b>{i.store_name}</b><small className="muted block">{i.number} · {planLabel(i.plan)}</small></span><b>{vnd(i.amount_vnd)}</b></li>
            ))}</ul>
          )}
          <p className="row-actions"><a className="btn btn-ghost btn-sm" href="#/quan-tri/hoa-don">Mở Hoá đơn</a></p>
        </section>
        <section className="panel">
          <h2>Khách mới</h2>
          {all.length === 0 ? <p className="muted">Chưa có khách nào đăng ký.</p> : (
            <ul className="admin-list">{all.slice(0, 5).map(c => (
              <li key={c.user_id}><span><b>{c.shops[0]?.store_name ?? 'Chưa tạo shop'}</b><small className="muted block">{c.email}</small></span><small className="muted">{dateTime(c.created_at)}</small></li>
            ))}</ul>
          )}
          <p className="row-actions"><a className="btn btn-ghost btn-sm" href="#/quan-tri/khach-hang">Xem tất cả khách</a></p>
        </section>
      </div>
    </>
  );
}

// ---------------- Khách hàng ----------------
function Customers({ d, reload, loading }: { d: Overview; reload: () => void; loading: boolean }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const [lock, setLock] = useState<AdminAccount | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const all = useMemo(() => customers(d), [d]);
  const list = useMemo(() => all.filter(c => match(c, f) &&
    (!q || `${c.email} ${c.shops.map(s => s.store_name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [all, f, q]);
  const viewing = all.find(c => c.user_id === view) ?? null;
  const done = (t: string) => { setMsg(t); reload(); };
  return (
    <>
      <PageHead title="Khách hàng" sub={`${all.length} khách · cập nhật ${dateTime(d.generated_at)}`}
        actions={<button className="btn btn-ghost" onClick={reload} disabled={loading}>Tải lại</button>} />
      {msg && <Notice kind="ok">{msg}</Notice>}
      <div className="admin-tools">
        <input type="search" placeholder="Tìm email hoặc tên shop…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm khách hàng" />
      </div>
      <div className="tabs" role="tablist" aria-label="Lọc khách hàng">
        {FILTERS.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={f === v} className={f === v ? 'on' : ''} onClick={() => setF(v)}>
            {l} <small>{all.filter(c => match(c, v)).length}</small>
          </button>
        ))}
      </div>
      {list.length === 0 ? <Empty title="Không có khách hàng ở mục này" /> : (
        <div className="table-wrap"><table className="table admin-table">
          <thead><tr><th>Khách hàng</th><th>Gói</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th><span className="sr">Thao tác</span></th></tr></thead>
          <tbody>{list.map(c => (
            <tr key={c.user_id}>
              <td data-label="Khách hàng"><b>{c.shops.length ? c.shops.map(s => s.store_name).join(', ') : 'Chưa tạo shop'}</b>
                <small className="muted block">{c.email}{!c.email_confirmed && ' · chưa xác nhận email'}</small></td>
              <td data-label="Gói"><b>{planLabel(c.plan)}</b>{c.planStatus && c.planStatus !== 'trial' && <> <span className={`pill ${PLAN_STATUS[c.planStatus][1]}`}>{PLAN_STATUS[c.planStatus][0]}</span></>}
                {c.pending > 0 && <small className="block"><span className="pill warn">Chờ thanh toán</span></small>}</td>
              <td data-label="Đăng nhập">{c.last_sign_in_at ? dateTime(c.last_sign_in_at) : <span className="muted">Chưa đăng nhập</span>}</td>
              <td data-label="Trạng thái">{c.locked ? <><span className="pill err">Đã khoá</span><small className="muted block">{c.lock_reason}</small></> : <span className="pill ok">Hoạt động</span>}</td>
              <td><div className="admin-acts">
                <button className="btn btn-sm btn-ghost" onClick={() => setView(c.user_id)} aria-label={`Xem ${c.email}`}>Xem</button>
                <button className={`btn btn-sm btn-ghost${c.locked ? '' : ' danger-text'}`} onClick={() => setLock(c)}>{c.locked ? 'Mở khoá' : 'Khoá'}</button>
              </div></td>
            </tr>))}
          </tbody>
        </table></div>
      )}
      {viewing && <DetailModal c={viewing} onClose={() => setView(null)} onLock={() => { setLock(viewing); setView(null); }} onPlan={t => { setView(null); done(t); }} />}
      {lock && <LockModal acc={lock} onClose={() => setLock(null)} onDone={t => { setLock(null); done(t); }} />}
    </>
  );
}

const plusDays = (n: number) => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };
function DetailModal({ c, onClose, onLock, onPlan }: { c: Customer; onClose: () => void; onLock: () => void; onPlan: (t: string) => void }) {
  const [edit, setEdit] = useState<AdminStore | null>(null);
  return (
    <Modal title="Thông tin khách hàng" onClose={onClose}>
      <dl className="admin-dl">
        <dt>Email</dt><dd>{c.email}{!c.email_confirmed && <small className="muted block">Chưa xác nhận email</small>}</dd>
        <dt>Đăng ký</dt><dd>{dateTime(c.created_at)}</dd>
        <dt>Đăng nhập gần nhất</dt><dd>{c.last_sign_in_at ? dateTime(c.last_sign_in_at) : 'Chưa đăng nhập'}</dd>
        <dt>Trạng thái</dt><dd>{c.locked ? `Đã khoá · ${c.lock_reason ?? ''}` : 'Hoạt động'}</dd>
      </dl>
      {c.shops.length === 0 ? <Notice>Khách này chưa tạo shop.</Notice> : c.shops.map(s => (
        <div key={s.store_id} className="admin-shop">
          <div className="admin-shop-head"><b>{s.store_name}</b>
            {edit?.store_id !== s.store_id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}>Đổi gói</button>}</div>
          <dl className="admin-dl">
            <dt>Gói</dt><dd>{planLabel(s.plan)}{s.plan_status !== 'trial' && ` · ${PLAN_STATUS[s.plan_status][0]}`}{s.renews_at && ` · đến ${dateTime(s.renews_at)}`}</dd>
            <dt>Thanh toán</dt><dd>{s.last_invoice_status ? INV[s.last_invoice_status][0] : 'Chưa có hoá đơn'}{s.paid_demo_vnd > 0 && ` · ${vnd(s.paid_demo_vnd)} (DEMO)`}</dd>
            <dt>Sản phẩm</dt><dd>{s.products}</dd>
            <dt>Đơn 7 ngày</dt><dd>{s.orders_7d}</dd>
            <dt>Thành viên</dt><dd>{s.members} người</dd>
          </dl>
          {edit?.store_id === s.store_id && <PlanForm s={s} onCancel={() => setEdit(null)} onDone={onPlan} />}
        </div>
      ))}
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        <button className={`btn ${c.locked ? 'btn-primary' : 'btn-danger'}`} onClick={onLock}>{c.locked ? 'Mở khoá' : 'Khoá tài khoản'}</button></div>
    </Modal>
  );
}

function PlanForm({ s, onCancel, onDone }: { s: AdminStore; onCancel: () => void; onDone: (t: string) => void }) {
  const [plan, setPlan] = useState<string>(s.plan);
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const [until, setUntil] = useState(s.renews_at && new Date(s.renews_at) > new Date() ? s.renews_at.slice(0, 10) : plusDays(30));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true); setErr('');
    const r = await supabase.rpc('admin_set_store_plan', { p_store: s.store_id, p_plan: plan, p_cycle: cycle,
      p_until: plan === 'trial' ? null : new Date(`${until}T23:59:00+07:00`).toISOString() });
    setBusy(false);
    if (r.error) return setErr(isMissingFeature(r.error) ? NEEDS_SQL : adminError(r.error));
    onDone(plan === 'trial' ? `${s.store_name} đã về gói Dùng thử.` : `${s.store_name}: gói ${planLabel(plan)} đến ${until.split('-').reverse().join('/')}.`);
  }
  return (
    <div className="admin-planform">
      <label>Gói<select value={plan} onChange={e => setPlan(e.target.value)}>
        <option value="trial">Dùng thử</option>{(Object.keys(PLANS) as PlanKey[]).map(k => <option key={k} value={k}>{PLANS[k].name}</option>)}</select></label>
      {plan !== 'trial' && <>
        <label>Chu kỳ<select value={cycle} onChange={e => setCycle(e.target.value as 'month' | 'year')}><option value="month">Theo tháng</option><option value="year">Theo năm</option></select></label>
        <label>Dùng đến<input type="date" value={until} min={plusDays(1)} onChange={e => setUntil(e.target.value)} /></label>
        <div className="admin-quick">{[30, 90, 365].map(n => <button key={n} type="button" className="chip" onClick={() => setUntil(plusDays(n))}>+{n === 365 ? '1 năm' : `${n} ngày`}</button>)}</div>
      </>}
      <p className="muted small">Không tạo hoá đơn. Dùng để tặng gói, gia hạn tay hoặc đưa shop về dùng thử.</p>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Thôi</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu gói'}</button></div>
    </div>
  );
}

// ---------------- Gói & giá ----------------
function useConfig() {
  return useLoad(async () => {
    const r = await supabase.rpc('admin_platform_config');
    if (r.error) { if (isMissingFeature(r.error)) return null; throw r.error; }
    return r.data as Config;
  }, []);
}

function Plans() {
  const cfg = useConfig();
  if (cfg.loading && !cfg.data) return <Spinner />;
  if (cfg.error) return <Notice kind="err">{friendlyError(cfg.error)}</Notice>;
  return (
    <>
      <PageHead title="Gói & giá" sub="Sửa tên, giá, tính năng từng gói. Khách thấy ngay ở trang Gói và thanh toán." />
      <Notice>Giá mới chỉ áp cho hoá đơn tạo sau khi lưu. Khách đang dùng gói không bị đổi giá. Thanh toán vẫn là bản DEMO.</Notice>
      {!cfg.data ? <Notice kind="warn">{NEEDS_SQL}</Notice> : (
        <div className="admin-plans">{cfg.data.plans.map(p => <PlanCard key={p.key + p.updated_at} p={p} onSaved={cfg.setData} />)}</div>
      )}
    </>
  );
}

function PlanCard({ p, onSaved }: { p: ServerPlan; onSaved: (c: Config) => void }) {
  const [f, setF] = useState({ name: p.name, month: String(p.month_vnd), year: p.year_months, tagline: p.tagline, who: p.who, features: p.features.join('\n'), best: p.best, visible: p.visible });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const month = Number(f.month.replace(/[.,\s]/g, ''));
  const dirty = f.name !== p.name || month !== p.month_vnd || f.year !== p.year_months || f.tagline !== p.tagline || f.who !== p.who
    || f.features !== p.features.join('\n') || f.best !== p.best || f.visible !== p.visible;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setMsg(null); };
  async function save() {
    setMsg(null);
    if (!Number.isInteger(month) || month < 0 || month > 5_000_000 || month % 1000 !== 0) return setMsg({ kind: 'err', text: ADMIN_ERRORS.invalid_price });
    setBusy(true);
    const r = await supabase.rpc('admin_save_plan', { p_key: p.key, p_data: { name: f.name, month_vnd: month, year_months: f.year, tagline: f.tagline, who: f.who,
      features: f.features.split('\n').map(x => x.trim()).filter(Boolean), best: f.best, visible: f.visible } });
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: adminError(r.error) });
    onSaved(r.data as Config);
  }
  return (
    <section className={`panel admin-plan${f.visible ? '' : ' off'}`} aria-label={`Gói ${p.name}`}>
      <div className="admin-plan-head"><h2>{f.name || p.key.toUpperCase()}</h2>
        {f.best && <span className="pill brand">Nên chọn</span>}{!f.visible && <span className="pill soft">Đang ẩn</span>}</div>
      <label>Tên gói<input value={f.name} maxLength={20} onChange={set('name')} /></label>
      <label>Giá mỗi tháng (đ)<input inputMode="numeric" value={f.month} onChange={set('month')} /></label>
      <label>Trả theo năm tính
        <select value={f.year} onChange={e => setF({ ...f, year: Number(e.target.value) })}>
          {[12, 11, 10, 9, 8].map(n => <option key={n} value={n}>{n} tháng{n < 12 ? ` (tặng ${12 - n} tháng)` : ' (không giảm)'}</option>)}
        </select>
        <small className="muted">Giá năm: <b>{Number.isFinite(month) ? vnd(month * f.year) : '—'}</b></small></label>
      <label>Mô tả ngắn<input value={f.tagline} maxLength={120} onChange={set('tagline')} /></label>
      <label>Dành cho<input value={f.who} maxLength={120} onChange={set('who')} /></label>
      <label>Tính năng (mỗi dòng một ý)<textarea rows={6} value={f.features} onChange={set('features')} /></label>
      <label className="check"><input type="checkbox" checked={f.best} onChange={e => setF({ ...f, best: e.target.checked })} /> Gắn nhãn "Nên chọn"</label>
      <label className="check"><input type="checkbox" checked={f.visible} onChange={e => setF({ ...f, visible: e.target.checked })} /> Hiện cho khách chọn</label>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="admin-plan-foot"><small className="muted">Sửa lần cuối {dateTime(p.updated_at)}</small>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Đang lưu…' : dirty ? 'Lưu gói' : 'Đã lưu'}</button></div>
    </section>
  );
}

// ---------------- Hoá đơn ----------------
function Invoices({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState<'pending' | 'paid' | 'void' | 'all'>('pending');
  const list = useLoad(async () => {
    const r = await supabase.rpc('admin_invoices', { p_status: null });
    if (r.error) { if (isMissingFeature(r.error)) return null; throw r.error; }
    return r.data as AdminInvoice[];
  }, []);
  const [act, setAct] = useState<{ inv: AdminInvoice; action: 'paid' | 'void' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const rows = (list.data ?? []).filter(i => tab === 'all' || i.status === tab);
  const total = rows.reduce((n, i) => n + i.amount_vnd, 0);
  async function go() {
    if (!act) return;
    setBusy(true);
    const r = await supabase.rpc('admin_set_invoice', { p_invoice: act.inv.id, p_action: act.action });
    setBusy(false);
    if (r.error) { setMsg({ kind: 'err', text: adminError(r.error) }); setAct(null); return; }
    list.setData(r.data as AdminInvoice[]);
    setMsg({ kind: 'ok', text: act.action === 'paid' ? `Đã xác nhận ${act.inv.number}. Gói của ${act.inv.store_name} đã kích hoạt.` : `Đã huỷ ${act.inv.number}.` });
    setAct(null); onChange();
  }
  return (
    <>
      <PageHead title="Hoá đơn" sub="Hoá đơn gói của mọi shop. Xác nhận khi đã nhận tiền để kích hoạt gói."
        actions={<button className="btn btn-ghost" onClick={list.reload} disabled={list.loading}>Tải lại</button>} />
      <div className="demo-banner" role="note"><b>BẢN DEMO</b><span>Chưa nối ngân hàng. "Đã nhận tiền" chỉ ghi nhận bằng tay, hệ thống không kiểm tra giao dịch.</span></div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {list.loading && !list.data ? <Spinner /> : list.error ? <Notice kind="err">{friendlyError(list.error)}</Notice> : !list.data ? <Notice kind="warn">{NEEDS_SQL}</Notice> : (<>
        <div className="tabs" role="tablist" aria-label="Lọc hoá đơn">
          {([['pending', 'Chờ thanh toán'], ['paid', 'Đã nhận tiền'], ['void', 'Đã huỷ'], ['all', 'Tất cả']] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
              {l} <small>{(list.data ?? []).filter(i => v === 'all' || i.status === v).length}</small></button>
          ))}
        </div>
        {rows.length === 0 ? <Empty title="Không có hoá đơn ở mục này" /> : (<>
          <div className="table-wrap"><table className="table admin-table">
            <thead><tr><th>Hoá đơn</th><th>Shop</th><th>Gói</th><th className="num">Số tiền</th><th>Trạng thái</th><th><span className="sr">Thao tác</span></th></tr></thead>
            <tbody>{rows.map(i => (
              <tr key={i.id}>
                <td data-label="Hoá đơn"><code>{i.number}</code><small className="muted block">{dateTime(i.created_at)} · ND: {i.transfer_note}</small></td>
                <td data-label="Shop"><b>{i.store_name}</b><small className="muted block">{i.owner_email ?? '—'}</small></td>
                <td data-label="Gói">{planLabel(i.plan)} · {i.cycle === 'year' ? 'năm' : 'tháng'}</td>
                <td data-label="Số tiền" className="num"><b>{vnd(i.amount_vnd)}</b></td>
                <td data-label="Trạng thái"><span className={`pill ${INV[i.status][1]}`}>{INV[i.status][0]}</span>{i.paid_at && <small className="muted block">{dateTime(i.paid_at)}</small>}</td>
                <td>{i.status === 'pending' && <div className="admin-acts">
                  <button className="btn btn-sm btn-primary" onClick={() => setAct({ inv: i, action: 'paid' })}>Đã nhận tiền</button>
                  <button className="btn btn-sm btn-ghost danger-text" onClick={() => setAct({ inv: i, action: 'void' })}>Huỷ</button></div>}</td>
              </tr>))}</tbody>
          </table></div>
          <p className="muted admin-total">{rows.length} hoá đơn · tổng {vnd(total)}</p>
        </>)}
      </>)}
      {act && (
        <Modal title={act.action === 'paid' ? 'Xác nhận đã nhận tiền?' : 'Huỷ hoá đơn?'} onClose={() => setAct(null)}>
          <p><b>{act.inv.store_name}</b> · {act.inv.number}</p>
          <p>{planLabel(act.inv.plan)} theo {act.inv.cycle === 'year' ? 'năm' : 'tháng'} · <b>{vnd(act.inv.amount_vnd)}</b></p>
          <p className="muted">{act.action === 'paid' ? 'Gói của shop sẽ được kích hoạt ngay. Chỉ bấm khi anh đã thấy tiền vào tài khoản.' : 'Shop sẽ phải tạo hoá đơn mới nếu muốn mua gói.'}</p>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setAct(null)}>Thôi</button>
            <button className={`btn ${act.action === 'paid' ? 'btn-primary' : 'btn-danger'}`} disabled={busy} onClick={go}>{act.action === 'paid' ? 'Xác nhận đã nhận tiền' : 'Huỷ hoá đơn'}</button></div>
        </Modal>
      )}
    </>
  );
}

// ---------------- Cài đặt ----------------
function SettingsPage() {
  const cfg = useConfig();
  if (cfg.loading && !cfg.data) return <Spinner />;
  if (cfg.error) return <Notice kind="err">{friendlyError(cfg.error)}</Notice>;
  return (
    <>
      <PageHead title="Cài đặt" sub="Thông báo chung và thông tin hỗ trợ khách thấy trong App." />
      {!cfg.data ? <Notice kind="warn">{NEEDS_SQL}</Notice> : <SettingsForm key={cfg.data.settings.updated_at} c={cfg.data} onSaved={cfg.setData} />}
    </>
  );
}

function SettingsForm({ c, onSaved }: { c: Config; onSaved: (c: Config) => void }) {
  const [f, setF] = useState<Settings>(c.settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const set = (k: keyof Settings) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setMsg(null); };
  async function save() {
    setBusy(true);
    const r = await supabase.rpc('admin_save_settings', { p_data: { notice: f.notice, support_zalo: f.support_zalo, support_phone: f.support_phone, support_email: f.support_email } });
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: adminError(r.error) });
    onSaved(r.data as Config); setMsg({ kind: 'ok', text: 'Đã lưu. Các shop thấy thay đổi khi mở lại App.' });
  }
  return (
    <div className="admin-grid two">
      <section className="panel form">
        <h2>Thông báo chung</h2>
        <label>Hiện trên đầu App của mọi shop (để trống = không hiện)
          <textarea rows={3} maxLength={300} value={f.notice} onChange={set('notice')} placeholder="Ví dụ: Tối nay 22h–23h bảo trì, bot có thể trả lời chậm." /></label>
        <small className="muted">{f.notice.length}/300</small>
        {f.notice.trim() && <div className="platform-notice" role="note"><b>TIEN404</b><span>{f.notice}</span></div>}
        <h2>Liên hệ hỗ trợ</h2>
        <p className="muted small">Hiện ở trang Gói và thanh toán của chủ shop.</p>
        <label>Zalo hỗ trợ<input inputMode="tel" value={f.support_zalo} onChange={set('support_zalo')} placeholder="09xx xxx xxx" /></label>
        <label>Số điện thoại<input inputMode="tel" value={f.support_phone} onChange={set('support_phone')} placeholder="09xx xxx xxx" /></label>
        <label>Email<input type="email" value={f.support_email} onChange={set('support_email')} placeholder="hotro@..." /></label>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div className="modal-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button></div>
      </section>
      <section className="panel">
        <h2>Quản trị viên</h2>
        <ul className="admin-list">{c.admins.map(a => <li key={a.email}><span><b>{a.email}</b>{a.note && <small className="muted block">{a.note}</small>}</span><small className="muted">từ {dateTime(a.added_at)}</small></li>)}</ul>
        <p className="muted small">Thêm hoặc bớt quản trị viên làm trong Supabase SQL Editor, để không ai tự cấp quyền qua web.</p>
      </section>
    </div>
  );
}

function LockModal({ acc, onClose, onDone }: { acc: AdminAccount; onClose: () => void; onDone: (t: string) => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const locking = !acc.locked;
  async function go() {
    setErr('');
    if (locking && reason.trim().length < 3) return setErr('Ghi lý do khoá (ít nhất 3 ký tự).');
    setBusy(true);
    const r = await supabase.rpc('admin_set_account_lock', { p_user: acc.user_id, p_locked: locking, p_reason: locking ? reason.trim() : null });
    setBusy(false);
    if (r.error) return setErr(adminError(r.error));
    onDone(locking ? `Đã khoá ${acc.email}.` : `Đã mở khoá ${acc.email}.`);
  }
  return (
    <Modal title={locking ? 'Khoá tài khoản' : 'Mở khoá tài khoản'} onClose={onClose}>
      <p><b>{acc.email}</b> · {acc.stores} shop</p>
      {locking ? <>
        <p className="muted">Người này sẽ không đăng nhập được nữa. Phiên đang mở hết hạn trong tối đa 1 giờ. Dữ liệu shop vẫn giữ nguyên.</p>
        <label className="form">Lý do (ghi vào nhật ký)<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: gửi tin rác cho khách" /></label>
      </> : <p className="muted">Người này đăng nhập lại được ngay. Lý do khoá trước: {acc.lock_reason}</p>}
      {err && <Notice kind="err">{err}</Notice>}
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Thôi</button>
        <button className={`btn ${locking ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={go}>{busy ? 'Đang xử lý…' : locking ? 'Khoá tài khoản' : 'Mở khoá'}</button></div>
    </Modal>
  );
}
