import { useState, type ReactNode } from 'react';

export function ZaloHubPanel({ bot, oaStatus, canManage }: { bot: ReactNode; oaStatus: string; canManage: boolean }) {
  const [kind, select] = useState<'bot' | 'oa' | null>(null);
  const [label, setLabel] = useState('Xem sản phẩm');
  const [target, setTarget] = useState('');
  return <section className="panel">
    <h2>Zalo Hub</h2>
    <div className="actions">
      <button className="btn btn-ghost" aria-pressed={kind === 'bot'} onClick={() => select('bot')}>Zalo Bot</button>
      <button className="btn btn-ghost" aria-pressed={kind === 'oa'} onClick={() => select('oa')}>Zalo Official Account</button>
    </div>
    {kind === 'bot' && <><h3>Kết nối Zalo Bot</h3><p>Khách chọn mục bằng tin nhắn, ví dụ “1. Xem sản phẩm”.</p>{bot}</>}
    {kind === 'oa' && <><h3>Kết nối Zalo OA</h3><p>{oaStatus}</p>
      <h3>Nút và menu của OA</h3>
      <p>Chủ OA thiết lập menu trong OA Manager theo quyền và gói của OA. Bản thử này chưa có quyền áp dụng menu qua API.</p>
      <label>Tên hành động<input disabled={!canManage} maxLength={60} value={label} onChange={e => setLabel(e.target.value)} /></label>
      <label>Đường dẫn đích<input disabled={!canManage} type="url" placeholder="https://…" value={target} onChange={e => setTarget(e.target.value)} /></label>
      <p><strong>Xem trước</strong> · {label || 'Hành động'} · {target.startsWith('https://') ? target : 'Chưa có đường dẫn HTTPS'}</p>
      {canManage && <a href="https://oa.zalo.me/manage" rel="noopener noreferrer" target="_blank">Mở OA Manager</a>}
    </>}
  </section>;
}
