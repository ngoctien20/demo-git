import { FormEvent, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { Faq, isMissingFeature, must, useLoad } from '../data';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';
import { Industry, useWorkspace } from '../workspace';

const SAMPLES_BY: Record<Industry, string[]> = {
  shop: ['Shop có đổi trả không?', 'Phí ship bao nhiêu?', 'Bảng size thế nào?', 'Có giao trong ngày không?'],
  artist: ['Liên hệ booking thế nào?', 'Bài hát mới nhất là gì?', 'Có bán vé sự kiện không?'],
  service: ['Giờ làm việc thế nào?', 'Có cần đặt hẹn trước không?', 'Thanh toán bằng cách nào?'],
  education: ['Khi nào khai giảng?', 'Học phí đóng thế nào?', 'Có học thử không?'],
};

export function Knowledge() {
  const { store, canManage } = useStore();
  const SAMPLES = SAMPLES_BY[useWorkspace().primary];
  const [edit, setEdit] = useState<Faq | 'new' | null>(null);
  const [preset, setPreset] = useState('');
  const { data, error, loading, reload } = useLoad(async () =>
    must(await supabase.from('store_faqs').select('id, question, answer, active, updated_at').eq('store_id', store.id).order('created_at')) as Faq[], [store.id]);

  if (error && isMissingFeature(error)) return <><PageHead title="Kho kiến thức" /><Notice kind="warn">Phần hỏi đáp chưa được bật trên máy chủ.</Notice></>;
  return (
    <>
      <PageHead title="Kho kiến thức" sub="Câu hỏi thường gặp, chính sách và hướng dẫn. Trợ lý ưu tiên dùng đúng nội dung này; thiếu thông tin thì nói chưa có."
        actions={canManage && <button className="btn btn-primary" onClick={() => { setPreset(''); setEdit('new'); }}>+ Thêm câu hỏi</button>} />
      {loading ? <Spinner /> : error ? <Notice kind="err">{friendlyError(error)}</Notice> : !data?.length ? (
        <Empty title="Chưa có câu hỏi nào">
          {canManage ? <>Gợi ý bắt đầu: {SAMPLES.map(s => <button key={s} className="chip-btn" onClick={() => { setPreset(s); setEdit('new'); }}>{s}</button>)}</> : 'Chủ sở hữu chưa thêm câu hỏi nào.'}
        </Empty>
      ) : (
        <div className="faq-list">
          {data.map(f => (
            <article key={f.id} className={`panel faq${f.active ? '' : ' off'}`}>
              <div><h3>{f.question}</h3><p>{f.answer}</p>{!f.active && <span className="pill">Đang ẩn với trợ lý</span>}</div>
              {canManage && <button className="btn btn-sm btn-ghost" onClick={() => setEdit(f)}>Sửa</button>}
            </article>
          ))}
          <p className="muted">{data.length}/200 câu hỏi</p>
        </div>
      )}
      {edit && <FaqForm storeId={store.id} f={edit === 'new' ? null : edit} preset={preset} onClose={() => setEdit(null)} onDone={async () => { setEdit(null); await reload(); }} />}
    </>
  );
}

function FaqForm({ storeId, f, preset, onClose, onDone }: { storeId: string; f: Faq | null; preset: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState(f?.question ?? preset);
  const [a, setA] = useState(f?.answer ?? '');
  const [active, setActive] = useState(f?.active ?? true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (q.trim().length < 2 || !a.trim()) return setErr('Vui lòng nhập câu hỏi và câu trả lời.');
    setBusy(true);
    const { error } = await supabase.rpc('save_store_faq', { p_store: storeId, p_id: f?.id ?? null, p_question: q, p_answer: a, p_active: active });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onDone();
  }
  async function remove() {
    if (!f) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_store_faq', { p_store: storeId, p_id: f.id });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onDone();
  }
  return (
    <Modal title={f ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Khách hỏi<input value={q} onChange={e => setQ(e.target.value)} maxLength={300} autoFocus /></label>
        <label>Trợ lý trả lời<textarea rows={5} value={a} onChange={e => setA(e.target.value)} maxLength={3000} /></label>
        <label className="check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>Cho trợ lý dùng câu trả lời này</span></label>
        {err && <Notice kind="err">{err}</Notice>}
        <div className="modal-actions">
          {f && (confirmDel
            ? <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Bấm lần nữa để xoá</button>
            : <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDel(true)}>Xoá</button>)}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  );
}
