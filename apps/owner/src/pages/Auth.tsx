import { FormEvent, useState } from 'react';
import { appUrl, friendlyError, supabase } from '../supabase';
import { go } from '../router';
import { Notice } from '../ui';
import { SITE_HOME } from '../config';

function Brand() {
  return <a className="auth-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b></a>;
}

export function AuthPage({ path }: { path: string }) {
  const mode = path === '/dang-ky' ? 'signup' : path === '/quen-mat-khau' ? 'forgot' : path === '/dat-lai-mat-khau' ? 'reset' : 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg({ kind: 'err', text: 'Email chưa đúng định dạng.' });
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setMsg({ kind: 'err', text: 'Mật khẩu cần ít nhất 8 ký tự.' });
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        go('/');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl() } });
        if (error) throw error;
        if (data.session) go('/');
        else setMsg({ kind: 'ok', text: 'Đã gửi thư xác nhận tới email của bạn. Mở thư và bấm liên kết để kích hoạt tài khoản, sau đó đăng nhập.' });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'Nếu email này có tài khoản, bạn sẽ nhận được thư đặt lại mật khẩu trong vài phút.' });
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'Đã đổi mật khẩu.' });
        setTimeout(() => go('/'), 800);
      }
    } catch (err) {
      setMsg({ kind: 'err', text: friendlyError(err) });
    } finally { setBusy(false); }
  }

  const title = { login: 'Đăng nhập', signup: 'Tạo tài khoản dùng thử', forgot: 'Quên mật khẩu', reset: 'Đặt mật khẩu mới' }[mode];
  const sub = {
    login: 'Quản lý trợ lý AI, kênh kết nối và khách hàng của bạn.',
    signup: 'Giai đoạn thử nghiệm: không cần thẻ, web chưa thu phí trực tuyến.',
    forgot: 'Nhập email đã đăng ký, chúng tôi gửi liên kết đặt lại mật khẩu.',
    reset: 'Nhập mật khẩu mới cho tài khoản của bạn.',
  }[mode];

  return (
    <div className="auth">
      <div className="auth-card">
        <Brand />
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        <form onSubmit={submit} className="form" noValidate>
          {mode !== 'reset' && (
            <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          )}
          {mode !== 'forgot' && (
            <label>{mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={mode === 'login' ? undefined : 8} />
            </label>
          )}
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Đang xử lý…' : title}</button>
        </form>
        <div className="auth-links">
          {mode === 'login' && <><a href="#/quen-mat-khau">Quên mật khẩu?</a><span>Chưa có tài khoản? <a href="#/dang-ky">Đăng ký dùng thử</a></span></>}
          {mode === 'signup' && <span>Đã có tài khoản? <a href="#/dang-nhap">Đăng nhập</a></span>}
          {mode === 'forgot' && <a href="#/dang-nhap">Quay lại đăng nhập</a>}
        </div>
        {mode === 'signup' && <p className="fine">Khi đăng ký, bạn đồng ý với <a href={`${SITE_HOME}terms.html`}>Điều khoản</a> và <a href={`${SITE_HOME}privacy.html`}>Chính sách quyền riêng tư</a>.</p>}
      </div>
    </div>
  );
}
