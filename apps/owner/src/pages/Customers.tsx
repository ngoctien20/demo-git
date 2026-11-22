import { FormEvent, useMemo, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { Customer, isMissingFeature, must, STAGES, useLoad } from '../data';
import { dateTime } from '../format';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';
import { INDUSTRY_META, useWorkspace } from '../workspace';

const stageLabel = (s?: string) => STAGES.find(x => x[0] === s)?.[1] ?? 'Mới';
const todayEndVN = () => { const d = new Date(Date.now() + 7 * 36e5); d.setUTCHours(23, 59, 59, 999); return new Date(d.getTime() - 7 * 36e5); };

export function Customers() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const meta = INDUSTRY_META[ws.primary];
  const shop = ws.industries.includes('shop');
  const [tab, setTab] = useState('');
  const [edit, setEdit] = useState<Customer | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    let r = await supabase.from('customers').select('id, display_name, phone, email, created_at, stage, follow_up_at, note').eq('store_id', store.id).order('created_at', { ascending: false }).limit(500);
    let staged = true;
    if (r.error && isMissingFeature(r.error)) {
      staged = false;
      r = await supabase.from('customers').select('id, display_name, phone, email, created_at').eq('store_id', store.id).order('created_at', { ascending: false }).limit(500) as typeof r;
    }
    const customers = must(r) as Customer[];
    const o = must(await supabase.from('orders').select('status').eq('store_id', store.id).in('status', ['confirmed', 'paid']));
    return { customers, staged, won: o.length };
  }, [store.id]);

  const kpi = useMemo(() => {
    const c = data?.customers ?? [];
    const end = todayEndVN().getTime();
    const won = c.filter(x => x.stage === 'won').length, lost = c.filter(x => x.stage === 'lost').length;
    return {
      needs: c.filter(x => x.stage === 'needs_human').length,
      today: c.filter(x => x.follow_up_at && new Date(x.follow_up_at).getTime() <= end && x.stage !== 'won' && x.stage !== 'lost').length,
      rate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    };
  }, [data]);
  const list = (data?.customers ?? []).filter(c => !tab || (c.stage ?? 'new') === tab);

  if (!canManage) return <><PageHead title={meta.people} /><Notice>Chỉ chủ sở hữu và quản lý xem được thông tin người tương tác.</Notice></>;
  return (
    <>
      <PageHead title={meta.people} sub={meta.peopleSub} />
      {loading ? <Spinner /> : error || !data ? <Notice kind="err">{friendlyError(error)}</Notice> : (
        <>
          {!data.staged && <Notice kind="warn">Phân loại theo giai đoạn chưa được bật trên máy chủ. Bạn vẫn xem được danh sách khách.</Notice>}
          <div className="kpis">
            <div className="kpi"><span>Cần người xử lý</span><b>{kpi.needs}</b><small>Khiếu nại, đòi gặp người thật, mặc cả</small></div>
            <div className="kpi"><span>Hẹn liên hệ hôm nay</span><b>{kpi.today}</b><small>Gồm cả hẹn đã quá ngày</small></div>
            {shop && <div className="kpi"><span>Đơn đã chốt</span><b>{data.won}</b><small>Đơn đã xác nhận hoặc đã thanh toán</small></div>}
            <div className="kpi"><span>Tỉ lệ chốt</span><b>{kpi.rate}%</b><small>Trên khách đã có kết quả</small></div>
          </div>
          <div className="tabs" role="tablist" aria-label="Lọc theo giai đoạn">
            {[['', 'Tất cả'] as [string, string], ...STAGES].map(([v, l]) => (
              <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
                {l} <small>{v ? data.customers.filter(c => (c.stage ?? 'new') === v).length : data.customers.length}</small>
              </button>
            ))}
          </div>
          {list.length === 0 ? <Empty title="Chưa có khách ở mục này">Khách sẽ xuất hiện khi nhắn với shop qua kênh đã kết nối.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Khách</th><th>Liên hệ</th><th>Giai đoạn</th><th>Hẹn liên hệ</th><th>Ghi chú</th>{data.staged && <th><span className="sr">Thao tác</span></th>}</tr></thead>
                <tbody>{list.map(c => (
                  <tr key={c.id}>
                    <td data-label="Khách"><b>{c.display_name}</b><br /><small className="muted">từ {dateTime(c.created_at)}</small></td>
                    <td data-label="Liên hệ">{c.phone || c.email || '—'}</td>
                    <td data-label="Giai đoạn"><span className={`pill ${c.stage === 'needs_human' ? 'warn' : c.stage === 'won' ? 'ok' : ''}`}>{stageLabel(c.stage)}</span></td>
                    <td data-label="Hẹn">{dateTime(c.follow_up_at)}</td>
                    <td data-label="Ghi chú">{c.note || '—'}</td>
                    {data.staged && <td className="row-actions"><button className="btn btn-sm btn-ghost" onClick={() => setEdit(c)}>Cập nhật</button></td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      {edit && <StageForm storeId={store.id} c={edit} onClose={() => setEdit(null)} onDone={async () => { setEdit(null); await reload(); }} />}
    </>
  );
}

function StageForm({ storeId, c, onClose, onDone }: { storeId: string; c: Customer; onClose: () => void; onDone: () => void }) {
  const [stage, setStage] = useState(c.stage ?? 'new');
  const local = c.follow_up_at ? new Date(new Date(c.follow_up_at).getTime() + 7 * 36e5).toISOString().slice(0, 16) : '';
  const [when, setWhen] = useState(local);
  const [note, setNote] = useState(c.note ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const follow = when ? new Date(when + ':00+07:00').toISOString() : null;
    const { error } = await supabase.rpc('set_customer_stage', { p_store: storeId, p_customer: c.id, p_stage: stage, p_follow_up_at: follow, p_note: note });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onDone();
  }
  return (
    <Modal title={c.display_name} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Giai đoạn<select value={stage} onChange={e => setStage(e.target.value)}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Hẹn liên hệ lại (giờ Việt Nam)<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
        <label>Ghi chú<textarea rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
        {err && <Notice kind="err">{err}</Notice>}
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
      </form>
    </Modal>
  );
}
