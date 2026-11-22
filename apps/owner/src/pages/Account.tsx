import { FormEvent, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { Notice, PageHead } from '../ui';

export function Account() {
  const { email, stores } = useStore();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function change(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw.length < 8) return setMsg({ kind: 'err', text: 'Mật khẩu cần ít nhất 8 ký tự.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ kind: 'err', text: friendlyError(error) });
    setPw(''); setMsg({ kind: 'ok', text: 'Đã đổi mật khẩu.' });
  }
  const ROLE = { owner: 'Chủ shop', manager: 'Quản lý', staff: 'Nhân viên' } as const;
  return (
    <>
      <PageHead title="Tài khoản" />
      <section className="panel">
        <h2>Thông tin đăng nhập</h2>
        <p>Email: <b>{email}</b></p>
        <form className="form narrow" onSubmit={change}>
          <label>Mật khẩu mới<input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <button className="btn btn-primary" disabled={busy}>Đổi mật khẩu</button>
        </form>
      </section>
      <section className="panel">
        <h2>Cửa hàng bạn có quyền</h2>
        <ul className="plain">{stores.map(s => <li key={s.id}>{s.name} <span className="muted">· {s.tenant_name} · {ROLE[s.role]}</span></li>)}</ul>
      </section>
      <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
    </>
  );
}
