import { FormEvent, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { appUrl, friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import { Modal, Notice, PageHead, Spinner } from '../ui';
import { dateTime } from '../format';
import { normalizeVnPhone, passwordScore } from './Auth';
import { Billing } from './Billing';

const TABS = [['ho-so', 'Hồ sơ'], ['bao-mat', 'Bảo mật'], ['goi', 'Gói và thanh toán'], ['workspace', 'Workspace']] as const;
type Tab = typeof TABS[number][0];
const ROLE = { owner: 'Chủ sở hữu', manager: 'Quản lý', staff: 'Nhân viên' } as const;
type Msg = { kind: 'ok' | 'err'; text: string } | null;

export function Account() {
  const { query } = useRoute();
  const tab = (TABS.some(t => t[0] === query.get('tab')) ? query.get('tab') : 'ho-so') as Tab;
  const [user, setUser] = useState<User | null>(null);
  const reloadUser = async () => { const { data } = await supabase.auth.getUser(); setUser(data.user ?? null); };
  useEffect(() => { reloadUser(); }, []);

  return (
    <>
      <PageHead title="Tài khoản" sub="Hồ sơ, bảo mật và gói dịch vụ của bạn" />
      <div className="tabs acct-tabs" role="tablist" aria-label="Mục tài khoản">
        {TABS.map(([k, label]) => (
          <a key={k} role="tab" aria-selected={tab === k} href={`#/tai-khoan?tab=${k}`}>{label}</a>
        ))}
      </div>
      {tab === 'goi' ? <Billing /> : !user ? <Spinner /> :
        tab === 'ho-so' ? <Profile user={user} onSaved={reloadUser} /> :
        tab === 'bao-mat' ? <Security user={user} /> : <Workspaces />}
    </>
  );
}

function Profile({ user, onSaved }: { user: User; onSaved: () => void }) {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; phone?: string };
  const [name, setName] = useState(meta.full_name ?? '');
  const [phone, setPhone] = useState(meta.phone ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const initials = (meta.full_name || user.email || '?').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() ?? '?';

  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (name.trim().length < 2) return setMsg({ kind: 'err', text: 'Họ tên cần ít nhất 2 ký tự.' });
    const p = normalizeVnPhone(phone);
    if (p === null) return setMsg({ kind: 'err', text: 'Số điện thoại chưa đúng. Ví dụ: 0912 345 678' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), phone: p || null } });
    setBusy(false);
    if (error) return setMsg({ kind: 'err', text: friendlyError(error) });
    setPhone(p); setMsg({ kind: 'ok', text: 'Đã lưu hồ sơ.' }); onSaved();
  }
  async function changeEmail(e: FormEvent) {
    e.preventDefault(); setEmailMsg(null);
    const m = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return setEmailMsg({ kind: 'err', text: 'Email mới chưa đúng định dạng.' });
    if (m === user.email) return setEmailMsg({ kind: 'err', text: 'Đây đang là email của bạn.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: m }, { emailRedirectTo: appUrl() });
    setBusy(false);
    if (error) return setEmailMsg({ kind: 'err', text: friendlyError(error) });
    setEmail(''); setEmailMsg({ kind: 'ok', text: `Đã gửi thư xác nhận tới ${m}. Email chỉ đổi sau khi bạn bấm liên kết trong thư.` });
  }

  return (
    <div className="acct-grid">
      <section className="panel">
        <div className="profile-head">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div><b>{meta.full_name || 'Chưa đặt tên'}</b><p className="muted">{user.email}</p>
            <p className="fine">Tham gia {dateTime(user.created_at)}{user.email_confirmed_at ? ' · Email đã xác nhận' : ''}</p></div>
        </div>
        <form className="form" onSubmit={save}>
          <label>Họ và tên<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Số điện thoại<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" /></label>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <div><button className="btn btn-primary" disabled={busy}>Lưu hồ sơ</button></div>
        </form>
      </section>
      <section className="panel">
        <h2>Email đăng nhập</h2>
        <p>Hiện tại: <b>{user.email}</b></p>
        <form className="form" onSubmit={changeEmail}>
          <label>Email mới<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email-moi@gmail.com" /></label>
          {emailMsg && <Notice kind={emailMsg.kind}>{emailMsg.text}</Notice>}
          <div><button className="btn btn-ghost" disabled={busy}>Đổi email</button></div>
        </form>
      </section>
    </div>
  );
}

function Security({ user }: { user: User }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [askAll, setAskAll] = useState(false);
  const score = passwordScore(pw);

  async function change(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!cur) return setMsg({ kind: 'err', text: 'Nhập mật khẩu hiện tại để xác nhận đây là bạn.' });
    if (pw.length < 8) return setMsg({ kind: 'err', text: 'Mật khẩu mới cần ít nhất 8 ký tự.' });
    if (pw !== pw2) return setMsg({ kind: 'err', text: 'Hai mật khẩu mới chưa giống nhau.' });
    if (pw === cur) return setMsg({ kind: 'err', text: 'Mật khẩu mới cần khác mật khẩu cũ.' });
    setBusy(true);
    try {
      const check = await supabase.auth.signInWithPassword({ email: user.email ?? '', password: cur });
      if (check.error) throw new Error(/Invalid login/i.test(check.error.message) ? 'wrong_current' : check.error.message);
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setCur(''); setPw(''); setPw2(''); setMsg({ kind: 'ok', text: 'Đã đổi mật khẩu.' });
    } catch (err) {
      setMsg({ kind: 'err', text: String((err as Error).message) === 'wrong_current' ? 'Mật khẩu hiện tại không đúng.' : friendlyError(err) });
    } finally { setBusy(false); }
  }

  return (
    <div className="acct-grid">
      <section className="panel">
        <h2>Đổi mật khẩu</h2>
        <form className="form" onSubmit={change}>
          <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
          <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></label>
          <label>Mật khẩu mới<input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <div className={`pw-meter s${score}`}><span /><span /><span /><span /><small>Ít nhất 8 ký tự. Nên có chữ hoa, số hoặc ký hiệu.</small></div>
          <label>Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang đổi…' : 'Đổi mật khẩu'}</button></div>
        </form>
        <p className="fine">Quên mật khẩu hiện tại? <a href={`#/quen-mat-khau`} onClick={e => { e.preventDefault(); supabase.auth.signOut().then(() => go('/quen-mat-khau')); }}>Đăng xuất và đặt lại qua email</a>.</p>
      </section>
      <section className="panel">
        <h2>Phiên đăng nhập</h2>
        <p className="muted">Lần đăng nhập gần nhất: {dateTime(user.last_sign_in_at)}</p>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Đăng xuất thiết bị này</button>
          <button className="btn btn-ghost danger-text" onClick={() => setAskAll(true)}>Đăng xuất mọi thiết bị</button>
        </div>
        <p className="fine">Dùng khi bạn nghi ai đó biết mật khẩu, hoặc quên đăng xuất ở máy lạ.</p>
      </section>
      {askAll && (
        <Modal title="Đăng xuất mọi thiết bị?" onClose={() => setAskAll(false)}>
          <p>Mọi điện thoại, máy tính đang đăng nhập tài khoản này sẽ phải đăng nhập lại.</p>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setAskAll(false)}>Thôi</button>
            <button className="btn btn-danger" onClick={() => supabase.auth.signOut({ scope: 'global' })}>Đăng xuất tất cả</button></div>
        </Modal>
      )}
    </div>
  );
}

function Workspaces() {
  const { stores, store } = useStore();
  return (
    <section className="panel">
      <h2>Workspace bạn có quyền</h2>
      <ul className="ws-list">{stores.map(s => (
        <li key={s.id}><b>{s.name}</b>{s.id === store.id && <span className="pill ok">Đang mở</span>}<span className="muted">{s.tenant_name} · {ROLE[s.role]}</span></li>
      ))}</ul>
      <p className="fine">Muốn thêm nhân viên? Chủ sở hữu mời ở Cài đặt. Đổi workspace ở menu bên trái.</p>
    </section>
  );
}
