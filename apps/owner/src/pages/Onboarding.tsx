import { FormEvent, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { Notice } from '../ui';

const INDUSTRIES: [string, string][] = [
  ['fashion', 'Thời trang'], ['beauty', 'Mỹ phẩm'], ['accessories', 'Phụ kiện'],
  ['ecommerce', 'Cửa hàng online'], ['services', 'Dịch vụ'], ['other', 'Khác'],
];

export function Onboarding({ email, onDone }: { email: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('fashion');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('Tên shop cần ít nhất 2 ký tự.');
    setBusy(true);
    const { error } = await supabase.rpc('register_shop', { p_name: name.trim(), p_industry: industry });
    if (error) { setErr(friendlyError(error)); setBusy(false); return; }
    await onDone();
  }

  return (
    <div className="auth">
      <div className="auth-card wide">
        <p className="eyebrow">Bước 1 / 3</p>
        <h1>Tạo cửa hàng của bạn</h1>
        <p className="muted">Đăng nhập bằng {email}. Bạn có thể đổi tên và thêm chi nhánh sau.</p>
        <form className="form" onSubmit={submit}>
          <label>Tên shop<input value={name} onChange={e => setName(e.target.value)} maxLength={150} placeholder="Ví dụ: Shop Hoa Mai" autoFocus /></label>
          <fieldset className="choice">
            <legend>Ngành hàng</legend>
            {INDUSTRIES.map(([v, l]) => (
              <label key={v} className={industry === v ? 'on' : ''}><input type="radio" name="industry" value={v} checked={industry === v} onChange={() => setIndustry(v)} />{l}</label>
            ))}
          </fieldset>
          {err && <Notice kind="err">{err}</Notice>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo cửa hàng'}</button>
        </form>
        <ol className="next-steps"><li className="done">Tạo tài khoản</li><li className="on">Tạo cửa hàng</li><li>Nhập sản phẩm và cài đặt bot</li></ol>
        <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
      </div>
    </div>
  );
}
