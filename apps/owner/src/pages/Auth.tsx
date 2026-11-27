import { FormEvent, useEffect, useState } from 'react';
import { appUrl, friendlyError, supabase } from '../supabase';
import { returnRoute } from '../loginFlow.mjs';
import { go, useRoute } from '../router';
import { Notice } from '../ui';
import { SITE_HOME } from '../config';
import { PLANS, PlanKey, rememberPlan } from '../billing';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** VN mobile: 0xxxxxxxxx or +84xxxxxxxxx (10 digits after normalising). Empty is allowed. */
export function normalizeVnPhone(raw: string): string | null {
  const d = raw.replace(/[\s.()-]/g, '');
  if (!d) return '';
  const n = d.startsWith('+84') ? '0' + d.slice(3) : d.startsWith('84') && d.length === 11 ? '0' + d.slice(2) : d;
  return /^0[35789]\d{8}$/.test(n) ? n : null;
}
/** 0..4 — length, upper+lower, digit, symbol. Only a hint; the server rule is "at least 8 characters". */
export function passwordScore(p: string): number {
  if (p.length < 8) return p ? 1 : 0;
  let s = 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return Math.min(s, 4);
}
const SCORE_TEXT = ['', 'Quá ngắn', 'Tạm được', 'Khá mạnh', 'Rất mạnh'];

function Brand() {
  return <a className="auth-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b></a>;
}

function PasswordField({ label, value, onChange, autoComplete, show, onToggle, id }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; onToggle: () => void; id: string;
}) {
  return (
    <div className="pw-field">
      <label htmlFor={id}>{label}</label>
      <span className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} required />
        <button type="button" className="pw-eye" onClick={onToggle} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={show}>{show ? 'Ẩn' : 'Hiện'}</button>
      </span>
    </div>
  );
}

function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return { left, start: () => setLeft(60) };
}

export function AuthPage({ path, callbackError = '' }: { path: string; callbackError?: string }) {
  const { query } = useRoute();
  const mode: Mode = path === '/dang-ky' ? 'signup' : path === '/quen-mat-khau' ? 'forgot' : path === '/dat-lai-mat-khau' ? 'reset' : 'login';
  const plan = (query.get('goi') && query.get('goi')! in PLANS ? query.get('goi') : null) as PlanKey | null;
  const [email, setEmail] = useState(query.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);   // "check your inbox" screen
  const [unconfirmed, setUnconfirmed] = useState(false);
  const cd = useCooldown();

  useEffect(() => { setMsg(null); setSentTo(null); setUnconfirmed(false); setPassword(''); setPassword2(''); }, [mode]);
  useEffect(() => { rememberPlan(plan); }, [plan]);

  async function resend() {
    if (cd.left > 0) return;
    setBusy(true); setMsg(null);
    try {
      const target = (sentTo ?? email).trim();
      const { error } = mode === 'forgot'
        ? await supabase.auth.resetPasswordForEmail(target, { redirectTo: appUrl() })
        : await supabase.auth.resend({ type: 'signup', email: target, options: { emailRedirectTo: appUrl() } });
      if (error) throw error;
      cd.start(); setMsg({ kind: 'ok', text: 'Đã gửi lại thư. Kiểm tra cả mục Thư rác / Quảng cáo.' });
    } catch (err) { setMsg({ kind: 'err', text: friendlyError(err) }); } finally { setBusy(false); }
  }

  async function google() {
    if (busy) return;
    if (mode === 'signup' && !agree) return setMsg({kind:'err', text:'Hãy xác nhận Điều khoản và Chính sách quyền riêng tư trước khi tiếp tục.'});
    setBusy(true);
    setMsg(null);
    try {
      sessionStorage.setItem('t404_google_return', returnRoute(location.hash));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: appUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setMsg({ kind: 'err', text: friendlyError(error) });
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null); setUnconfirmed(false);
    const mail = email.trim().toLowerCase();
    if (mode !== 'reset' && !EMAIL_RE.test(mail)) return setMsg({ kind: 'err', text: 'Email chưa đúng định dạng, ví dụ: tenshop@gmail.com' });
    if (mode === 'login' && !password) return setMsg({ kind: 'err', text: 'Bạn chưa nhập mật khẩu.' });
    let phoneN = '';
    if (mode === 'signup') {
      if (name.trim().length < 2) return setMsg({ kind: 'err', text: 'Vui lòng nhập họ tên (ít nhất 2 ký tự).' });
      const p = normalizeVnPhone(phone);
      if (p === null) return setMsg({ kind: 'err', text: 'Số điện thoại chưa đúng. Ví dụ: 0912 345 678' });
      phoneN = p;
    }
    if ((mode === 'signup' || mode === 'reset')) {
      if (password.length < 8) return setMsg({ kind: 'err', text: 'Mật khẩu cần ít nhất 8 ký tự.' });
      if (password !== password2) return setMsg({ kind: 'err', text: 'Hai mật khẩu chưa giống nhau.' });
    }
    if (mode === 'signup' && !agree) return setMsg({ kind: 'err', text: 'Bạn cần đồng ý Điều khoản và Chính sách quyền riêng tư.' });
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) { if (/Email not confirmed/i.test(error.message)) setUnconfirmed(true); throw error; }
        go('/');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: {
          emailRedirectTo: appUrl(), data: { full_name: name.trim(), phone: phoneN || null, signup_plan: plan ?? null },
        } });
        if (error) throw error;
        // Supabase hides "already registered" when e-mail confirmation is on: identities comes back empty.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('User already registered');
        if (data.session) go(plan ? '/tai-khoan?tab=goi' : '/');
        else { setSentTo(mail); cd.start(); }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: appUrl() });
        if (error) throw error;
        setSentTo(mail); cd.start();
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'Đã đặt mật khẩu mới. Đang vào App…' });
        setTimeout(() => go('/'), 900);
      }
    } catch (err) {
      setMsg({ kind: 'err', text: friendlyError(err) });
    } finally { setBusy(false); }
  }

  const title = { login: 'Đăng nhập', signup: 'Tạo tài khoản', forgot: 'Quên mật khẩu', reset: 'Đặt mật khẩu mới' }[mode];
  const sub = {
    login: 'Chào mừng bạn quay lại. Quản lý trợ lý AI, đơn hàng và khách của shop.',
    signup: 'Dùng thử miễn phí, không cần thẻ. Mất khoảng 1 phút.',
    forgot: 'Nhập email đã đăng ký, chúng tôi gửi liên kết đặt lại mật khẩu.',
    reset: 'Chọn mật khẩu mới cho tài khoản của bạn.',
  }[mode];
  const score = passwordScore(password);

  if (sentTo) {
    return (
      <AuthFrame>
        <div className="sent-ico" aria-hidden="true">✉</div>
        <h1>Kiểm tra hộp thư</h1>
        <p className="muted">
          {mode === 'forgot' ? 'Nếu email này đã có tài khoản, ' : ''}chúng tôi đã gửi thư tới <b>{sentTo}</b>.{' '}
          {mode === 'forgot' ? 'Bấm liên kết trong thư để đặt mật khẩu mới.' : 'Bấm liên kết trong thư để kích hoạt tài khoản, sau đó đăng nhập.'}
        </p>
        <ul className="ticks small"><li>Thư thường đến trong 1–2 phút</li><li>Không thấy? Xem mục Thư rác hoặc Quảng cáo</li><li>Liên kết chỉ dùng được một lần</li></ul>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button type="button" className="btn btn-ghost btn-block" onClick={resend} disabled={busy || cd.left > 0}>
          {cd.left > 0 ? `Gửi lại thư sau ${cd.left} giây` : 'Gửi lại thư'}
        </button>
        <div className="auth-links">
          <button type="button" className="link-btn" onClick={() => setSentTo(null)}>Sửa email</button>
          <a href="#/dang-nhap">Về trang đăng nhập</a>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <div className="auth-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
        {mode === 'login' || mode === 'signup' ? <>
          <a role="tab" aria-selected={mode === 'login'} href="#/dang-nhap">Đăng nhập</a>
          <a role="tab" aria-selected={mode === 'signup'} href={`#/dang-ky${plan ? `?goi=${plan}` : ''}`}>Đăng ký</a>
        </> : null}
      </div>
      <h1>{title}</h1>
      <p className="muted">{sub}</p>
      {mode === 'signup' && plan && (
        <div className="plan-chip"><span>Gói bạn chọn</span><b>{PLANS[plan].name}</b><small>Thanh toán (bản DEMO) sau khi vào App, mục Tài khoản › Gói và thanh toán.</small></div>
      )}
      {callbackError && <Notice kind="warn">{callbackError}</Notice>}
      {(mode === 'login' || mode === 'signup') && <button type="button" className="btn btn-ghost btn-block" onClick={google} disabled={busy}>Tiếp tục với Google</button>}
      <form onSubmit={submit} className="form" noValidate>
        {mode === 'signup' && <>
          <label>Họ và tên<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn An" required /></label>
          <label><span>Số điện thoại <span className="muted">(không bắt buộc)</span></span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" />
          </label>
        </>}
        {mode !== 'reset' && (
          <label>Email<input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tenshop@gmail.com" required /></label>
        )}
        {mode !== 'forgot' && (
          <PasswordField id="pw1" label={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'} value={password} onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} show={show} onToggle={() => setShow(!show)} />
        )}
        {mode === 'login' && <a className="forgot-link" href={`#/quen-mat-khau${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}>Quên mật khẩu?</a>}
        {(mode === 'signup' || mode === 'reset') && <>
          <div className={`pw-meter s${score}`} aria-live="polite"><span /><span /><span /><span /><small>{password ? `Độ mạnh: ${SCORE_TEXT[score]}` : 'Ít nhất 8 ký tự. Nên có chữ hoa, số hoặc ký hiệu.'}</small></div>
          <PasswordField id="pw2" label="Nhập lại mật khẩu" value={password2} onChange={setPassword2} autoComplete="new-password" show={show} onToggle={() => setShow(!show)} />
        </>}
        {mode === 'signup' && (
          <label className="check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>Tôi đồng ý với <a href={`${SITE_HOME}terms.html`} target="_blank" rel="noopener">Điều khoản</a> và <a href={`${SITE_HOME}privacy.html`} target="_blank" rel="noopener">Chính sách quyền riêng tư</a>.</span>
          </label>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        {unconfirmed && <button type="button" className="btn btn-ghost btn-block" onClick={resend} disabled={busy || cd.left > 0}>{cd.left > 0 ? `Gửi lại thư xác nhận sau ${cd.left} giây` : 'Gửi lại thư xác nhận'}</button>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'signup' ? 'Tạo tài khoản miễn phí' : mode === 'forgot' ? 'Gửi liên kết đặt lại' : title}</button>
      </form>
      <div className="auth-links">
        {mode === 'login' && <span>Chưa có tài khoản? <a href="#/dang-ky">Đăng ký miễn phí</a></span>}
        {mode === 'signup' && <span>Đã có tài khoản? <a href="#/dang-nhap">Đăng nhập</a></span>}
        {mode === 'forgot' && <a href="#/dang-nhap">← Quay lại đăng nhập</a>}
      </div>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <Brand />
        <h2>Trợ lý AI bán hàng cho shop Việt</h2>
        <ul>
          <li><b>Trả lời khách 24/7</b><span>Zalo, Messenger và web, đúng giá, đúng tồn kho.</span></li>
          <li><b>Chốt đơn chắc tiền</b><span>Báo đơn mới, giữ hàng, nhắc khách chuyển khoản.</span></li>
          <li><b>Dễ dùng</b><span>Gói LITE nối bot Zalo chỉ bằng mã 6 số.</span></li>
        </ul>
        <p className="fine">Đang thử nghiệm. Chưa thu phí trực tuyến.</p>
      </aside>
      <div className="auth-card">
        <div className="auth-card-brand"><Brand /></div>
        {children}
      </div>
    </div>
  );
}
