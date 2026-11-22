import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { BotSettingsRow, isMissingFeature, useLoad } from '../data';
import { dateTime } from '../format';
import { Notice, PageHead, Spinner } from '../ui';

const TONES: { v: BotSettingsRow['tone']; label: string; sample: string }[] = [
  { v: 'polite', label: 'Lịch sự', sample: 'Dạ, mẫu này shop còn size M ạ. Anh/chị cần lấy mấy chiếc ạ?' },
  { v: 'friendly', label: 'Thân thiện', sample: 'Còn size M nha bạn, bạn lấy mấy cái để mình ghi đơn nhé?' },
  { v: 'cute', label: 'Dễ thương', sample: 'Dạ còn size M nè bạn ơi 💕 bạn lấy mấy cái để em lên đơn liền nha!' },
];
const EMPTY: BotSettingsRow = { shop_info: '', forbidden_promises: '', tone: 'polite', bot_enabled: true, notify_emails: [], updated_at: '' };

export function BotSettings() {
  const { store, canManage } = useStore();
  const { data, error, loading, reload } = useLoad(async () => {
    const r = await supabase.from('store_bot_settings').select('shop_info, forbidden_promises, tone, bot_enabled, notify_emails, updated_at').eq('store_id', store.id).maybeSingle();
    if (r.error) throw r.error;
    return r.data as BotSettingsRow | null;
  }, [store.id]);
  const [f, setF] = useState<BotSettingsRow>(EMPTY);
  const [emailDraft, setEmailDraft] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(data ?? EMPTY); }, [data]);

  if (loading) return <Spinner />;
  if (error) return <><PageHead title="Cài đặt bot" /><Notice kind={isMissingFeature(error) ? 'warn' : 'err'}>{isMissingFeature(error) ? 'Cài đặt bot chưa được bật trên máy chủ. Đội TIEN404 sẽ mở trong đợt cập nhật tới.' : friendlyError(error)}</Notice></>;

  const dirty = JSON.stringify({ ...f, updated_at: '' }) !== JSON.stringify({ ...(data ?? EMPTY), updated_at: '' });
  const addEmail = () => {
    const e = emailDraft.trim().toLowerCase().replace(/,$/, '');
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setMsg({ kind: 'err', text: `“${e}” chưa đúng định dạng email.` });
    if (f.notify_emails.length >= 5) return setMsg({ kind: 'err', text: 'Tối đa 5 email.' });
    if (!f.notify_emails.includes(e)) setF({ ...f, notify_emails: [...f.notify_emails, e] });
    setEmailDraft(''); setMsg(null);
  };
  const onEmailKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } };

  async function save(e?: FormEvent, patch?: Partial<BotSettingsRow>) {
    e?.preventDefault(); setMsg(null);
    const next = { ...f, ...patch };
    setBusy(true);
    const { error } = await supabase.rpc('save_store_bot_settings', {
      p_store: store.id, p_shop_info: next.shop_info, p_forbidden: next.forbidden_promises, p_tone: next.tone,
      p_bot_enabled: next.bot_enabled, p_notify_emails: next.notify_emails, p_expected_updated_at: data?.updated_at ?? null,
    });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: friendlyError(error) }); return; }
    setMsg({ kind: 'ok', text: 'Đã lưu cài đặt.' });
    await reload();
  }

  return (
    <>
      <PageHead title="Cài đặt bot" sub={`Cách trợ lý AI nói chuyện với khách của ${store.name}.`} />
      {!canManage && <Notice>Bạn đang ở vai trò nhân viên nên chỉ xem được cài đặt.</Notice>}
      <section className="panel toggle-panel">
        <div>
          <h2>Bot trả lời khách</h2>
          <p className="muted">{f.bot_enabled ? 'Bot đang được phép trả lời khách trên các kênh đã kết nối.' : 'Bot đang tắt. Khách nhắn sẽ chờ bạn tự trả lời.'}</p>
        </div>
        <button type="button" role="switch" aria-checked={f.bot_enabled} className={`switch${f.bot_enabled ? ' on' : ''}`} disabled={!canManage || busy}
          onClick={() => save(undefined, { bot_enabled: !f.bot_enabled })}><span className="sr">Bật hoặc tắt bot</span></button>
      </section>
      <form className="panel form" onSubmit={save}>
        <fieldset disabled={!canManage || busy}>
          <h2>Giọng nói của bot</h2>
          <div className="tones">
            {TONES.map(t => (
              <label key={t.v} className={`tone${f.tone === t.v ? ' on' : ''}`}>
                <input type="radio" name="tone" checked={f.tone === t.v} onChange={() => setF({ ...f, tone: t.v })} />
                <b>{t.label}</b><span>“{t.sample}”</span>
              </label>
            ))}
          </div>
          <h2>Thông tin shop</h2>
          <label>Bot dùng thông tin này để trả lời: địa chỉ, giờ mở cửa, phí và thời gian giao hàng, cách thanh toán, đổi trả.
            <textarea rows={6} maxLength={4000} value={f.shop_info} onChange={e => setF({ ...f, shop_info: e.target.value })}
              placeholder={'Địa chỉ: 12 Lê Lợi, Q.1, TP.HCM\nMở cửa: 8:00–21:00 mỗi ngày\nGiao hàng: toàn quốc, 2–4 ngày, phí 30.000đ, miễn phí từ 500.000đ\nThanh toán: COD hoặc chuyển khoản'} />
            <small className="muted">{f.shop_info.length}/4000</small>
          </label>
          <label>Điều bot không được hứa với khách
            <textarea rows={3} maxLength={2000} value={f.forbidden_promises} onChange={e => setF({ ...f, forbidden_promises: e.target.value })}
              placeholder={'Không hứa giao trong ngày\nKhông tự giảm giá hay tặng quà\nKhông hứa hoàn tiền khi chưa hỏi chủ shop'} />
          </label>
          <h2>Email báo đơn chốt</h2>
          <p className="muted">Khi bot ghi nhận khách chốt đơn, TIEN404 gửi email gồm tên, số điện thoại, sản phẩm, tổng tiền và địa chỉ giao. Tính năng gửi sẽ bật khi đơn hàng chạy trên App.</p>
          <div className="chips">
            {f.notify_emails.map(e => <span key={e} className="chip">{e}<button type="button" aria-label={`Xoá ${e}`} onClick={() => setF({ ...f, notify_emails: f.notify_emails.filter(x => x !== e) })}>✕</button></span>)}
            {f.notify_emails.length < 5 && <input value={emailDraft} onChange={e => setEmailDraft(e.target.value)} onKeyDown={onEmailKey} onBlur={addEmail} placeholder="Nhập email rồi bấm Enter" aria-label="Thêm email nhận thông báo" />}
          </div>
          <small className="muted">Tối đa 5 email. Để trống để tắt thông báo.</small>
        </fieldset>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        {canManage && <div className="form-foot">
          <span className="muted">{data?.updated_at ? `Lưu lần cuối ${dateTime(data.updated_at)}` : 'Chưa lưu lần nào'}</span>
          <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => setF(data ?? EMPTY)}>Hoàn tác</button>
          <button className="btn btn-primary" disabled={(!dirty && !!data) || busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>}
      </form>
    </>
  );
}
