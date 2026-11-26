// Platform Admin (TIEN404 staff only). Access is decided by the SERVER: public.is_platform_admin() and every admin_* RPC
// re-check app_private.platform_admins. Hiding the menu is only cosmetic; a shop owner calling these RPCs gets access_denied.
import { useMemo, useState } from 'react';
import { supabase, friendlyError } from '../supabase';
import { isMissingFeature, useLoad } from '../data';
import { dateTime, vnd } from '../format';
import { Modal, Notice, PageHead, Spinner } from '../ui';
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

export function Admin({ isAdmin }: { isAdmin: boolean | null }) {
  const ov = useLoad(async () => {
    if (!isAdmin) return null;
    const r = await supabase.rpc('admin_overview');
    if (r.error) throw r.error;
    return r.data as Overview;
  }, [isAdmin]);
  const [tab, setTab] = useState<'shops' | 'accounts'>('shops');
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [lock, setLock] = useState<AdminAccount | null>(null);
  const [bot, setBot] = useState<AdminStore | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const d = ov.data;
  const stores = useMemo(() => (d?.stores ?? []).filter(s =>
    (plan === 'all' || s.plan === plan) &&
    (!q || `${s.store_name} ${s.tenant_name} ${s.owner_email ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [d, q, plan]);
  const accounts = useMemo(() => (d?.accounts ?? []).filter(a => !q || a.email.toLowerCase().includes(q.toLowerCase())), [d, q]);

  if (isAdmin === null) return <Spinner />;
  if (!isAdmin) return (<><PageHead title="Quản trị nền tảng" /><Notice kind="err">Bạn không có quyền quản trị nền tảng. Trang này chỉ dành cho đội TIEN404.</Notice></>);
  if (ov.loading && !d) return <Spinner label="Đang tải dữ liệu quản trị…" />;
  if (ov.error) return (<><PageHead title="Quản trị nền tảng" /><Notice kind="err">{isMissingFeature(ov.error) ? 'Máy chủ chưa bật phần Quản trị (db/v28-account chưa áp).' : friendlyError(ov.error)}</Notice></>);
  if (!d) return null;

  const k = {
    shops: d.stores.length, accounts: d.accounts.length,
    active: d.stores.filter(s => s.plan_status === 'active').length,
    pending: d.stores.reduce((n, s) => n + s.pending_invoices, 0),
    botOff: d.stores.filter(s => s.bot_enabled === false).length,
    locked: d.accounts.filter(a => a.locked).length,
    demoVnd: d.stores.reduce((n, s) => n + s.paid_demo_vnd, 0),
  };

  return (
    <>
      <PageHead title="Quản trị nền tảng" sub={`Chỉ đội TIEN404 thấy trang này · cập nhật ${dateTime(d.generated_at)}`}
        actions={<button className="btn btn-ghost" onClick={ov.reload} disabled={ov.loading}>Tải lại</button>} />
      <div className="admin-banner"><b>Khu vực quản trị</b><span>Dữ liệu của mọi shop. Mọi thao tác khoá/mở và bật/tắt bot đều được ghi nhật ký. Thanh toán đang ở chế độ DEMO.</span></div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="kpis admin-kpis">
        <div className="kpi"><span>Shop</span><b>{k.shops}</b></div>
        <div className="kpi"><span>Tài khoản</span><b>{k.accounts}</b></div>
        <div className="kpi"><span>Gói đang chạy</span><b>{k.active}</b></div>
        <div className="kpi"><span>Hoá đơn chờ</span><b>{k.pending}</b></div>
        <div className="kpi"><span>Bot đang tắt</span><b>{k.botOff}</b></div>
        <div className="kpi"><span>TK bị khoá</span><b>{k.locked}</b></div>
        <div className="kpi wide"><span>Đã “thu” (DEMO)</span><b>{vnd(k.demoVnd)}</b></div>
      </div>

      <div className="toolbar admin-tools">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'shops'} onClick={() => setTab('shops')}>Shop ({d.stores.length})</button>
          <button type="button" role="tab" aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>Tài khoản ({d.accounts.length})</button>
        </div>
        <input type="search" placeholder={tab === 'shops' ? 'Tìm shop hoặc email chủ…' : 'Tìm email…'} value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm kiếm" />
        {tab === 'shops' && (
          <select value={plan} onChange={e => setPlan(e.target.value)} aria-label="Lọc theo gói">
            <option value="all">Mọi gói</option><option value="trial">Dùng thử</option>
            {(Object.keys(PLANS) as PlanKey[]).map(p => <option key={p} value={p}>{PLANS[p].name}</option>)}
          </select>
        )}
      </div>

      {tab === 'shops' ? (
        <div className="table-wrap"><table className="table admin-table">
          <thead><tr><th>Shop</th><th>Chủ shop</th><th>Gói</th><th>Thanh toán</th><th>Bot</th><th className="num">SP</th><th className="num">Đơn 7 ngày</th></tr></thead>
          <tbody>{stores.map(s => (
            <tr key={s.store_id}>
              <td data-label="Shop"><b>{s.store_name}</b><small className="muted block">{s.tenant_name} · {s.members} người · tạo {dateTime(s.created_at)}</small></td>
              <td data-label="Chủ shop">{s.owner_email ?? '—'}{s.owner_locked && <span className="pill err">Đã khoá</span>}</td>
              <td data-label="Gói"><b>{s.plan === 'trial' ? 'Dùng thử' : PLANS[s.plan].name}</b> <span className={`pill ${PLAN_STATUS[s.plan_status][1]}`}>{PLAN_STATUS[s.plan_status][0]}</span>
                {s.renews_at && <small className="muted block">đến {dateTime(s.renews_at)}</small>}</td>
              <td data-label="Thanh toán">{s.last_invoice_status ? <span className={`pill ${INV[s.last_invoice_status][1]}`}>{INV[s.last_invoice_status][0]}</span> : <span className="muted">Chưa có</span>}
                {s.paid_demo_vnd > 0 && <small className="muted block">{vnd(s.paid_demo_vnd)} (DEMO)</small>}</td>
              <td data-label="Bot"><button type="button" className={`switch-btn ${s.bot_enabled === false ? 'off' : 'on'}`} onClick={() => setBot(s)}
                aria-label={`Bot của ${s.store_name}: ${s.bot_enabled === false ? 'đang tắt' : 'đang bật'}. Bấm để đổi`}>{s.bot_enabled === false ? 'Tắt' : s.bot_enabled ? 'Bật' : 'Mặc định bật'}</button></td>
              <td data-label="SP" className="num">{s.products}</td>
              <td data-label="Đơn 7 ngày" className="num">{s.orders_7d}</td>
            </tr>))}
            {stores.length === 0 && <tr><td colSpan={7} className="muted">Không có shop phù hợp.</td></tr>}
          </tbody>
        </table></div>
      ) : (
        <div className="table-wrap"><table className="table admin-table">
          <thead><tr><th>Email</th><th>Tạo lúc</th><th>Đăng nhập gần nhất</th><th className="num">Shop</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{accounts.map(a => (
            <tr key={a.user_id}>
              <td data-label="Email"><b>{a.email}</b>{a.is_admin && <span className="pill brand">Admin</span>}{!a.email_confirmed && <small className="muted block">Chưa xác nhận email</small>}</td>
              <td data-label="Tạo lúc">{dateTime(a.created_at)}</td>
              <td data-label="Đăng nhập">{dateTime(a.last_sign_in_at)}</td>
              <td data-label="Shop" className="num">{a.stores}</td>
              <td data-label="Trạng thái">{a.locked ? <><span className="pill err">Đã khoá</span><small className="muted block">{a.lock_reason}</small></> : <span className="pill ok">Hoạt động</span>}</td>
              <td>{!a.is_admin && <button className={`btn btn-sm ${a.locked ? 'btn-ghost' : 'btn-ghost danger-text'}`} onClick={() => setLock(a)}>{a.locked ? 'Mở khoá' : 'Khoá'}</button>}</td>
            </tr>))}
            {accounts.length === 0 && <tr><td colSpan={6} className="muted">Không có tài khoản phù hợp.</td></tr>}
          </tbody>
        </table></div>
      )}

      {lock && <LockModal acc={lock} onClose={() => setLock(null)} onDone={t => { setLock(null); setMsg({ kind: 'ok', text: t }); ov.reload(); }} />}
      {bot && <BotModal s={bot} onClose={() => setBot(null)} onDone={t => { setBot(null); setMsg({ kind: 'ok', text: t }); ov.reload(); }} />}
    </>
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

function BotModal({ s, onClose, onDone }: { s: AdminStore; onClose: () => void; onDone: (t: string) => void }) {
  const turnOn = s.bot_enabled === false;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    const r = await supabase.rpc('admin_set_store_bot', { p_store: s.store_id, p_enabled: turnOn });
    setBusy(false);
    if (r.error) return setErr(adminError(r.error));
    onDone(`Đã ${turnOn ? 'bật' : 'tắt'} bot của ${s.store_name}.`);
  }
  return (
    <Modal title={turnOn ? 'Bật bot của shop' : 'Tắt bot của shop'} onClose={onClose}>
      <p><b>{s.store_name}</b> · {s.owner_email}</p>
      <p className="muted">{turnOn ? 'Bot sẽ trả lời khách trở lại.' : 'Bot ngừng trả lời khách của shop này cho tới khi bật lại.'} Chủ shop thấy thay đổi trong Cài đặt.</p>
      <Notice kind="warn">Lưu ý: các bot đang chạy trên n8n hiện chưa đọc công tắc này. Cần nối thêm trước khi dùng thật.</Notice>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Thôi</button>
        <button className={`btn ${turnOn ? 'btn-primary' : 'btn-danger'}`} disabled={busy} onClick={go}>{turnOn ? 'Bật bot' : 'Tắt bot'}</button></div>
    </Modal>
  );
}
