// Reports + AI Daily Briefing (CANDIDATE). Numbers come only from tables that exist and are
// store-scoped by RLS; a metric without a verified source shows "—" and says why. The briefing
// settings form is a UI contract proposal: nothing is saved and nothing is sent (no backend yet).
import { useState } from 'react';
import { useStore } from '../store';
import { useLoad } from '../data';
import { supabase } from '../supabase';
import { vnd } from '../format';
import { Industry, INDUSTRY_META, useWorkspace } from '../workspace';
import { Notice, PageHead, Spinner } from '../ui';

type Metric = { key: string; label: string; source: string; industries?: Industry[]; value: (d: Data) => string | null };
type Data = { convs: Record<string, number> | null; orders: { n: number; pending: number; revenue: number } | null; needs: number | null; faqs: number | null; assistantsLive: number | null };

export const BRIEFING_METRICS: Metric[] = [
  { key: 'conv_messenger', label: 'Cuộc trò chuyện Messenger', source: 'conversations (channel = messenger)', value: d => d.convs ? String(d.convs.messenger ?? 0) : null },
  { key: 'conv_web', label: 'Hội thoại Website', source: 'conversations (channel = web)', value: d => d.convs ? String(d.convs.web ?? 0) : null },
  { key: 'conv_zalo', label: 'Hội thoại Zalo', source: 'conversations (channel = zalo)', value: d => d.convs ? String((d.convs.zalo ?? 0) + (d.convs.zalo_bot ?? 0)) : null },
  { key: 'handoff', label: 'Cần nhân viên xử lý', source: 'customers (stage = needs_human)', value: d => d.needs == null ? null : String(d.needs) },
  { key: 'orders', label: 'Đơn hàng mới', source: 'orders', industries: ['shop'], value: d => d.orders ? `${d.orders.n} (${d.orders.pending} chờ duyệt)` : null },
  { key: 'revenue', label: 'Doanh thu đã xác nhận', source: 'orders (confirmed, paid)', industries: ['shop'], value: d => d.orders ? vnd(d.orders.revenue) : null },
  { key: 'contact_requests', label: 'Yêu cầu liên hệ quản lý / booking', source: 'chưa có nguồn (cần ghi sự kiện bàn giao)', industries: ['artist', 'service', 'education'], value: () => null },
  { key: 'top_questions', label: 'Câu hỏi thường gặp nhất', source: 'chưa có nguồn (cần lưu tin nhắn đã ẩn danh)', value: () => null },
  { key: 'incidents', label: 'Sự cố kết nối / lỗi vận hành', source: 'chưa có nguồn (cần nhật ký lỗi kênh)', value: () => null },
];

export function Reports() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const [days, setDays] = useState(1);
  const { data, loading } = useLoad<Data>(async () => {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const [c, o, n, f] = await Promise.all([
      supabase.from('conversations').select('channel').eq('store_id', store.id).gte('created_at', since).limit(5000),
      ws.industries.includes('shop') ? supabase.from('orders').select('status, total_vnd').eq('store_id', store.id).gte('created_at', since) : Promise.resolve(null),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('stage', 'needs_human'),
      supabase.from('store_faqs').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
    ]);
    const convs = c.error ? null : (c.data as { channel: string }[]).reduce<Record<string, number>>((a, x) => { a[x.channel] = (a[x.channel] ?? 0) + 1; return a; }, {});
    const od = o && !o.error ? o.data as { status: string; total_vnd: number }[] : null;
    return {
      convs,
      orders: od ? { n: od.length, pending: od.filter(x => x.status === 'pending').length, revenue: od.filter(x => x.status === 'confirmed' || x.status === 'paid').reduce((a, x) => a + Number(x.total_vnd), 0) } : null,
      needs: n.error ? null : n.count ?? 0, faqs: f.error ? null : f.count ?? 0, assistantsLive: null,
    };
  }, [store.id, days, ws.industries.join()]);

  const metrics = BRIEFING_METRICS.filter(m => !m.industries || m.industries.some(i => ws.industries.includes(i)));
  if (!canManage) return <><PageHead title="Báo cáo" /><Notice>Chỉ chủ sở hữu và quản lý xem được báo cáo.</Notice></>;
  return (
    <>
      <PageHead title="Báo cáo" sub={`Số liệu đã xác minh của ${store.name}.`}
        actions={<div className="tabs" role="tablist" aria-label="Khoảng thời gian">{[[1, '24 giờ'], [7, '7 ngày'], [30, '30 ngày']].map(([v, l]) =>
          <button key={v} role="tab" aria-selected={days === v} className={days === v ? 'on' : ''} onClick={() => setDays(v as number)}>{l}</button>)}</div>} />
      {loading || !data ? <Spinner /> : (
        <section className="panel">
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Chỉ số</th><th className="num">Giá trị</th><th>Nguồn dữ liệu</th></tr></thead>
            <tbody>{metrics.map(m => { const v = m.value(data); return (
              <tr key={m.key}><td>{m.label}</td><td className="num">{v ?? '—'}</td><td><small className={v == null ? 'muted' : ''}>{v == null && !m.source.startsWith('chưa') ? 'chưa đọc được: ' : ''}{m.source}</small></td></tr>); })}</tbody>
          </table></div>
          <p className="fine muted">"—" nghĩa là chưa có nguồn dữ liệu đã xác minh. TIEN404 không dùng AI để ước đoán số liệu.</p>
        </section>
      )}
      <Briefing metrics={metrics} data={data} />
    </>
  );
}

function Briefing({ metrics, data }: { metrics: Metric[]; data: Data | null }) {
  const { store, email } = useStore();
  const ws = useWorkspace();
  const [time, setTime] = useState('07:30');
  const [pick, setPick] = useState<string[]>(metrics.map(m => m.key));
  const [dest, setDest] = useState<'email' | 'telegram' | 'zalo'>('email');
  const toggle = (k: string) => setPick(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
  const lines = metrics.filter(m => pick.includes(m.key)).map(m => `• ${m.label}: ${data ? m.value(data) ?? 'chưa có dữ liệu' : '…'}`);
  return (
    <section className="panel form briefing">
      <div className="status-line"><h2>Báo cáo AI mỗi sáng</h2><span className="pill warn">Bản đề xuất · chưa gửi</span></div>
      <p className="muted">Mỗi sáng gửi tóm tắt hoạt động đã xác minh cho chủ {INDUSTRY_META[ws.primary].short.toLowerCase()}. Phần này mới là thiết kế giao diện và hợp đồng dữ liệu: chưa lưu cài đặt, chưa có hệ thống gửi.</p>
      <div className="row2">
        <label>Giờ gửi<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        <label>Múi giờ<select disabled value="Asia/Ho_Chi_Minh"><option value="Asia/Ho_Chi_Minh">Giờ Việt Nam (GMT+7)</option></select></label>
      </div>
      <label>Gửi tới
        <select value={dest} onChange={e => setDest(e.target.value as typeof dest)}>
          <option value="email">Email ({email})</option><option value="telegram">Telegram chủ sở hữu (cần liên kết)</option><option value="zalo">Zalo chủ sở hữu (cần liên kết)</option>
        </select>
      </label>
      <fieldset className="choice"><legend>Nội dung</legend>
        {metrics.map(m => <label key={m.key} className={pick.includes(m.key) ? 'on' : ''}><input type="checkbox" checked={pick.includes(m.key)} onChange={() => toggle(m.key)} />{m.label}</label>)}
      </fieldset>
      <h3>Xem trước</h3>
      <p className="bubble pre">{`Chào buổi sáng! Tóm tắt 24 giờ qua của ${store.name}:\n${lines.join('\n')}\n\nChỉ gồm số liệu có nguồn đã xác minh.`}</p>
      <div className="form-foot"><span className="muted">Chỉ chủ sở hữu và quản lý nhận được báo cáo.</span><button className="btn btn-primary" disabled title="Cần duyệt backend gửi báo cáo">Lưu cài đặt (chưa mở)</button></div>
    </section>
  );
}
