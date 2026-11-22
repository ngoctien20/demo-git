import { FormEvent, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { Notice } from '../ui';
import { WORKSPACE_KINDS } from '../workspace';

export function Onboarding({ email, onDone }: { email: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('retail');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('Tên cần ít nhất 2 ký tự.');
    setBusy(true);
    const { error } = await supabase.rpc('register_shop', { p_name: name.trim(), p_industry: industry });
    if (error) { setErr(friendlyError(error)); setBusy(false); return; }
    await onDone();
  }

  return (
    <div className="auth">
      <div className="auth-card wide">
        <p className="eyebrow">Bước 1 / 3</p>
        <h1>Tạo không gian làm việc</h1>
        <p className="muted">Đăng nhập bằng {email}. Workspace là nơi bạn quản lý trợ lý AI, kiến thức và kênh kết nối. Đổi tên được sau.</p>
        <form className="form" onSubmit={submit}>
          <label>Tên tổ chức, shop hoặc nghệ danh<input value={name} onChange={e => setName(e.target.value)} maxLength={150} placeholder="Ví dụ: Shop Hoa Mai, Ban nhạc Gió Bấc" autoFocus /></label>
          <fieldset className="choice">
            <legend>Lĩnh vực</legend>
            {WORKSPACE_KINDS.map(k => (
              <label key={k.value} className={industry === k.value ? 'on' : ''}><input type="radio" name="industry" value={k.value} checked={industry === k.value} onChange={() => setIndustry(k.value)} /><span>{k.label}<small className="muted">{k.hint}</small></span></label>
            ))}
          </fieldset>
          {err && <Notice kind="err">{err}</Notice>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo Workspace'}</button>
        </form>
        <ol className="next-steps"><li className="done">Tạo tài khoản</li><li className="on">Tạo Workspace</li><li>Tạo trợ lý từ mẫu ngành</li></ol>
        <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
      </div>
    </div>
  );
}
