// Platform Admin (TIEN404 staff only). Access is decided by the SERVER: public.is_platform_admin() and every admin_* RPC
// re-check app_private.platform_admins. Hiding the menu is only cosmetic; a shop owner calling these RPCs gets access_denied.
import { useMemo, useState } from 'react';
import { SITE_HOME } from '../config';
import { supabase, friendlyError } from '../supabase';
import { isMissingFeature, useLoad } from '../data';
import { dateTime, vnd } from '../format';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';
import { PLANS, PlanKey } from '../billing';
import './admin.css';

const ADMIN_ERRORS: Record<string, string> = {
  cannot_lock_self: 'Bạn không thể tự khoá tài khoản của mình.',
  cannot_lock_admin: 'Không thể khoá tài khoản quản trị viên khác.',
  invalid_reason: 'Lý do khoá cần từ 3 đến 300 ký tự.',
  invalid_account: 'Không tìm thấy tài khoản này.',
};
const adminError = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e);
  for (const [k, v] of Object.entries(ADMIN_ERRORS)) if (m.includes(k)) return v;
  return friendlyError(e);
};

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

const PLAN_STATUS: Record<string, [string, string]> = { trial: ['Dùng thử', 'soft'], active: ['Đang hoạt động', 'ok'], canceled: ['Huỷ gia hạn', 'warn'] };
const INV: Record<string, [string, string]> = { pending: ['Chờ thanh toán', 'warn'], paid: ['Đã trả (DEMO)', 'ok'], void: ['Đã huỷ', 'soft'] };

// One customer = one account (shop owner) with the shops they own. Only things an admin can really act on are shown:
// who the customer is, their plan and payment, whether they still log in, and lock / unlock. The bot switch was
// removed on purpose: the n8n bots do not read it yet, so it would look like it works when it does not.
type Customer = AdminAccount & { shops: AdminStore[]; plan: AdminStore['plan'] | null; planStatus: AdminStore['plan_status'] | null; pending: number };
type Filter = 'all' | 'trial' | 'paid' | 'pending' | 'noshop' | 'locked';
const FILTERS: [Filter, string][] = [['all', 'Tất cả'], ['paid', 'Đang dùng gói'], ['trial', 'Dùng thử'], ['pending', 'Chờ thanh toán'], ['noshop', 'Chưa tạo shop'], ['locked', 'Đã khoá']];
const match = (c: Customer, f: Filter) =>
  f === 'all' ? true : f === 'paid' ? c.planStatus === 'active' && c.plan !== 'trial' : f === 'trial' ? c.shops.length > 0 && (c.plan === 'trial' || c.planStatus === 'trial')
    : f === 'pending' ? c.pending > 0 : f === 'noshop' ? c.shops.length === 0 : c.locked;
const planName = (p: Customer['plan']) => !p ? '—' : p === 'trial' ? 'Dùng thử' : PLANS[p].name;

/** Whole admin app (admin build only): its own small layout, no shop pages. */
export function AdminApp({ email }: { email: string }) {
  const adm = useLoad(async () => {
    const r = await supabase.rpc('is_platform_admin', {}, { get: true });
    return !r.error && r.data === true;
  }, []);
  const [open, setOpen] = useState(false);
  return (
    <div className={`shell admin-shell${open ? ' nav-open' : ''}`}>
      <header className="mobile-bar">
        <button type="button" className="icon-btn" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} aria-controls="admin-side" onClick={() => setOpen(!open)}>☰</button>
        <b>TIEN404 Quản trị</b>
      </header>
      <aside className="side" id="admin-side" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <a className="side-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b><small>Quản trị</small></a>
        <nav aria-label="Menu quản trị">
          <div className="nav-group"><p>Quản trị</p><a href="#/quan-tri" aria-current="page"><span aria-hidden="true">♧</span>Khách hàng</a></div>
        </nav>
        <div className="side-foot">
          <span className="muted" title={email}>{email}</span>
          <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="content" id="main"><Admin isAdmin={adm.loading ? null : adm.data === true} /></main>
    </div>
  );
}

export function Admin({ isAdmin }: { isAdmin: boolean | null }) {
  const ov = useLoad(async () => {
    if (!isAdmin) return null;
    const r = await supabase.rpc('admin_overview');
    if (r.error) throw r.error;
    return r.data as Overview;
  }, [isAdmin]);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const [lock, setLock] = useState<AdminAccount | null>(null);
  const [view, setView] = useState<Customer | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const d = ov.data;
  const all = useMemo<Customer[]>(() => (d?.accounts ?? []).filter(a => !a.is_admin).map(a => {
    const shops = (d?.stores ?? []).filter(s => s.owner_id === a.user_id);
    const main = shops.find(s => s.plan_status === 'active') ?? shops[0];
    return { ...a, shops, plan: main?.plan ?? null, planStatus: main?.plan_status ?? null, pending: shops.reduce((n, s) => n + s.pending_invoices, 0) };
  }).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))), [d]);
  const list = useMemo(() => all.filter(c => match(c, f) &&
    (!q || `${c.email} ${c.shops.map(s => s.store_name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [all, f, q]);

  if (isAdmin === null) return <Spinner />;
  if (!isAdmin) return (<><PageHead title="Quản trị nền tảng" /><Notice kind="err">Bạn không có quyền quản trị nền tảng. Trang này chỉ dành cho đội TIEN404.</Notice></>);
  if (ov.loading && !d) return <Spinner label="Đang tải danh sách khách hàng…" />;
  if (ov.error) return (<><PageHead title="Khách hàng" /><Notice kind="err">{isMissingFeature(ov.error) ? 'Máy chủ chưa bật phần Quản trị (db/v28-account chưa áp).' : friendlyError(ov.error)}</Notice></>);
  if (!d) return null;

  return (
    <>
      <PageHead title="Khách hàng" sub={`Các shop đang dùng TIEN404 · cập nhật ${dateTime(d.generated_at)}`}
        actions={<button className="btn btn-ghost" onClick={ov.reload} disabled={ov.loading}>Tải lại</button>} />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="kpis">
        <div className="kpi"><span>Khách hàng</span><b>{all.length}</b><small>Tài khoản đã đăng ký</small></div>
        <div className="kpi"><span>Đang dùng gói</span><b>{all.filter(c => match(c, 'paid')).length}</b><small>Gói LITE / PLUS / PRO (DEMO)</small></div>
        <div className="kpi"><span>Chờ thanh toán</span><b>{all.filter(c => match(c, 'pending')).length}</b><small>Có hoá đơn chưa trả</small></div>
        <div className="kpi"><span>Đã khoá</span><b>{all.filter(c => c.locked).length}</b><small>Không đăng nhập được</small></div>
      </div>
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
              <td data-label="Gói"><b>{planName(c.plan)}</b>{c.planStatus && c.planStatus !== 'trial' && <> <span className={`pill ${PLAN_STATUS[c.planStatus][1]}`}>{PLAN_STATUS[c.planStatus][0]}</span></>}
                {c.pending > 0 && <small className="block"><span className="pill warn">Chờ thanh toán</span></small>}</td>
              <td data-label="Đăng nhập">{c.last_sign_in_at ? dateTime(c.last_sign_in_at) : <span className="muted">Chưa đăng nhập</span>}</td>
              <td data-label="Trạng thái">{c.locked ? <><span className="pill err">Đã khoá</span><small className="muted block">{c.lock_reason}</small></> : <span className="pill ok">Hoạt động</span>}</td>
              <td><div className="admin-acts">
                <button className="btn btn-sm btn-ghost" onClick={() => setView(c)} aria-label={`Xem ${c.email}`}>Xem</button>
                <button className={`btn btn-sm btn-ghost${c.locked ? '' : ' danger-text'}`} onClick={() => setLock(c)}>{c.locked ? 'Mở khoá' : 'Khoá'}</button>
              </div></td>
            </tr>))}
          </tbody>
        </table></div>
      )}

      {view && <DetailModal c={view} onClose={() => setView(null)} onLock={() => { setLock(view); setView(null); }} />}
      {lock && <LockModal acc={lock} onClose={() => setLock(null)} onDone={t => { setLock(null); setMsg({ kind: 'ok', text: t }); ov.reload(); }} />}
    </>
  );
}

function DetailModal({ c, onClose, onLock }: { c: Customer; onClose: () => void; onLock: () => void }) {
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
          <b>{s.store_name}</b>
          <dl className="admin-dl">
            <dt>Gói</dt><dd>{planName(s.plan)}{s.plan_status !== 'trial' && ` · ${PLAN_STATUS[s.plan_status][0]}`}{s.renews_at && ` · đến ${dateTime(s.renews_at)}`}</dd>
            <dt>Thanh toán</dt><dd>{s.last_invoice_status ? INV[s.last_invoice_status][0] : 'Chưa có hoá đơn'}{s.paid_demo_vnd > 0 && ` · ${vnd(s.paid_demo_vnd)} (DEMO)`}</dd>
            <dt>Sản phẩm</dt><dd>{s.products}</dd>
            <dt>Đơn 7 ngày</dt><dd>{s.orders_7d}</dd>
            <dt>Thành viên</dt><dd>{s.members} người</dd>
          </dl>
        </div>
      ))}
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        <button className={`btn ${c.locked ? 'btn-primary' : 'btn-danger'}`} onClick={onLock}>{c.locked ? 'Mở khoá' : 'Khoá tài khoản'}</button></div>
    </Modal>
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
