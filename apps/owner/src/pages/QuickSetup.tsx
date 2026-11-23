// "Tạo trợ lý nhanh": the owner sends a price-list photo, a public page link or pasted text; the
// Worker route /v1/setup/draft (setup/worker/setup-route.mjs) returns a DRAFT. Nothing is saved
// until the owner reviews it here and presses "Xác nhận". Saving uses only RPCs that already exist:
//   products -> save_merchant_product_in_store, FAQs -> save_store_faq,
//   services -> the service assistant DRAFT (save_assistant_draft; customers see it only after Kích hoạt).
import { ChangeEvent, useMemo, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { SETUP_API } from '../config';
import { parseVnd, vnd } from '../format';
import { industryFromTemplate, useWorkspace } from '../workspace';
import { Config, newItem, resort, Service } from '../assistant';
import { Notice, PageHead, Spinner } from '../ui';

type Kind = 'product' | 'service' | 'course';
type Item = { name: string; group: string; kind: Kind; price_text: string; price_vnd: number | null; duration_min: number | null; check: string };
type Draft = { business_name: string; industry_label: string; customer_word: string; opening_hours: string; items: Item[]; faqs: { question: string; answer: string }[]; unreadable: string; needs_check: number };
type Row = Item & { use: boolean; price: string; stock: string };
type Source = 'image' | 'url' | 'text';

const ERRORS: Record<string, string> = {
  LOGIN_WALLED: 'Trang Facebook/Instagram/TikTok cần đăng nhập nên không đọc được. Anh/chị chụp màn hình bảng giá rồi gửi ảnh nhé.',
  HTTPS_ONLY: 'Link phải bắt đầu bằng https://', BAD_URL: 'Link chưa đúng.', PAGE_TOO_LARGE: 'Trang quá lớn, hãy gửi ảnh bảng giá.',
  NOT_A_WEB_PAGE: 'Link này không phải trang web.', PAGE_EMPTY: 'Trang không có chữ đọc được, hãy gửi ảnh.',
  IMAGE_TOO_LARGE: 'Ảnh quá lớn (tối đa 5 MB).', IMAGE_TYPE_NOT_ALLOWED: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.',
  DAILY_CAP_REACHED: 'Hôm nay đã dùng hết 20 lượt. Mai thử lại nhé.', AI_BUSY: 'AI đang bận, thử lại sau 1 phút.',
  AI_REFUSED: 'AI không đọc được nội dung này.', TOO_MANY_ITEMS: 'Bảng giá quá dài, hãy chụp từng phần.',
  TEXT_TOO_SHORT: 'Nội dung quá ngắn.', SETUP_DRAFT_DISABLED: 'Chức năng chưa bật trên máy chủ.', UNAUTHORIZED: 'Phiên đăng nhập hết hạn, hãy đăng nhập lại.',
};
const KIND_LABEL: Record<Kind, string> = { product: 'Sản phẩm', service: 'Dịch vụ', course: 'Khóa học' };

// Shown only when the owner presses "Xem ví dụ": clearly a sample, never saved.
const SAMPLE: Draft = {
  business_name: 'Hoa Nail (ví dụ)', industry_label: 'Tiệm nail', customer_word: 'khách', opening_hours: '9h - 21h hằng ngày',
  items: [
    { name: 'Sơn gel tay', group: 'Tay', kind: 'service', price_text: '120k', price_vnd: 120000, duration_min: 45, check: 'ok' },
    { name: 'Đắp bột', group: 'Tay', kind: 'service', price_text: '250K', price_vnd: 250000, duration_min: null, check: 'AI đọc giá lệch, cần xem lại' },
    { name: 'Vẽ móng', group: 'Tay', kind: 'service', price_text: 'từ 20k', price_vnd: null, duration_min: null, check: 'Giá chưa rõ ("từ 20k")' },
    { name: 'Dũa móng cá nhân', group: '', kind: 'product', price_text: '35.000đ', price_vnd: 35000, duration_min: null, check: 'ok' },
  ],
  faqs: [{ question: 'Mấy giờ tiệm mở cửa?', answer: '9h - 21h hằng ngày' }], unreadable: 'Dòng cuối bị mờ', needs_check: 2,
};

async function photoToBase64(file: File): Promise<{ media_type: string; data: string }> {
  // Shrink big phone photos (fewer tokens, under 5 MB). Text on a price list stays readable at 1800 px.
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', 0.85));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { media_type: 'image/jpeg', data: btoa(bin) };
}

export function QuickSetup() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const [src, setSrc] = useState<Source>('image');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sample, setSample] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [faqUse, setFaqUse] = useState<boolean[]>([]);
  const [saved, setSaved] = useState('');

  const load = (d: Draft, isSample: boolean) => {
    setDraft(d); setSample(isSample); setSaved(''); setErr('');
    setRows(d.items.map(i => ({ ...i, use: i.check === 'ok', price: i.price_vnd === null ? '' : String(i.price_vnd), stock: '0' })));
    setFaqUse(d.faqs.map(() => true));
  };

  async function send() {
    setErr(''); setBusy(true);
    try {
      let body: Record<string, unknown>;
      if (src === 'image') { if (!file) throw new Error('Chọn ảnh bảng giá trước.'); body = { image: await photoToBase64(file) }; }
      else if (src === 'url') body = { url: url.trim() };
      else body = { text };
      const { data } = await supabase.auth.getSession();
      const r = await fetch(SETUP_API, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session?.access_token ?? '') }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(ERRORS[j.error] ?? 'Chưa đọc được. Thử ảnh rõ hơn hoặc thử lại sau.');
      load(j.draft as Draft, false);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); }
    finally { setBusy(false); }
  }

  const set = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const problems = useMemo(() => rows.map(r => {
    if (!r.use) return '';
    if (!r.name.trim()) return 'Thiếu tên';
    if (parseVnd(r.price) === null) return 'Nhập giá bằng số, ví dụ 120000';
    if (r.kind === 'product' && !/^\d+$/.test(r.stock)) return 'Tồn kho là số từ 0';
    return '';
  }), [rows]);
  const chosen = rows.filter(r => r.use);
  const serviceAssistant = ws.assistants.find(a => industryFromTemplate(a.template_key) === 'service');
  const needsServiceAssistant = chosen.some(r => r.kind !== 'product') && !serviceAssistant;

  async function confirm() {
    if (sample || !draft) return;
    setBusy(true); setErr(''); setSaved('');
    const done: string[] = [];
    try {
      // 1) Products, with SKUs that do not collide with this store's existing ones.
      const prods = chosen.filter(r => r.kind === 'product');
      if (prods.length) {
        const ex = await supabase.from('products').select('sku').eq('store_id', store.id);
        if (ex.error) throw ex.error;
        const taken = new Set((ex.data ?? []).map(p => String(p.sku).toUpperCase()));
        let n = 0;
        for (const r of prods) {
          let sku = '';
          do sku = 'M' + String(++n).padStart(3, '0'); while (taken.has(sku));
          taken.add(sku);
          const { error } = await supabase.rpc('save_merchant_product_in_store', { p_store: store.id, p_sku: sku, p_name: r.name.trim(), p_price: parseVnd(r.price), p_active: true, p_initial_stock: Number(r.stock), p_expected_updated_at: null });
          if (error) throw error;
        }
        done.push(prods.length + ' sản phẩm');
      }
      // 2) Services / courses -> the service assistant DRAFT (not live until Kích hoạt on Menu page).
      const svcs = chosen.filter(r => r.kind !== 'product');
      if (svcs.length && serviceAssistant) {
        const v = await supabase.from('assistant_config_versions').select('state, config, config_sha256').eq('assistant_id', serviceAssistant.id).in('state', ['draft', 'published']);
        if (v.error) throw v.error;
        const base = (v.data.find(x => x.state === 'draft') ?? v.data.find(x => x.state === 'published'));
        if (!base) throw new Error('Trợ lý dịch vụ chưa có cấu hình.');
        const cfg = JSON.parse(JSON.stringify(base.config)) as Config;
        let item = cfg.menu.find(m => m.action_type === 'SHOW_SERVICES');
        if (!item) { item = newItem('SHOW_SERVICES', cfg.menu, 'Xem dịch vụ'); cfg.menu = resort([...cfg.menu, item]); }
        const list = ((item.action_config.items as Service[]) ?? []).slice();
        for (const r of svcs) list.push({ name: r.name.trim().slice(0, 80), price_vnd: parseVnd(r.price), ...(r.duration_min ? { note: r.duration_min + ' phút' } : {}) });
        item.action_config = { ...item.action_config, items: list };
        const draftRow = v.data.find(x => x.state === 'draft');
        const { error } = await supabase.rpc('save_assistant_draft', { p_assistant: serviceAssistant.id, p_config: cfg, p_expected_sha: draftRow?.config_sha256 ?? null });
        if (error) throw error;
        done.push(svcs.length + ' dịch vụ (bản nháp, bấm Kích hoạt ở Menu & hành động để khách thấy)');
      }
      // 3) FAQs
      const faqs = draft.faqs.filter((_, i) => faqUse[i]);
      for (const f of faqs) {
        const { error } = await supabase.rpc('save_store_faq', { p_store: store.id, p_id: null, p_question: f.question, p_answer: f.answer, p_active: true });
        if (error) throw error;
      }
      if (faqs.length) done.push(faqs.length + ' câu hỏi thường gặp');
      setSaved('Đã lưu: ' + (done.join(', ') || 'không có mục nào') + '.');
      setDraft(null); setRows([]);
    } catch (e) {
      setErr((done.length ? 'Đã lưu ' + done.join(', ') + ', rồi gặp lỗi: ' : '') + (e instanceof Error && !('code' in e) ? e.message : friendlyError(e)));
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Tạo trợ lý nhanh" sub="Gửi ảnh bảng giá hoặc link website. AI đọc ra bản nháp, anh/chị xem lại rồi mới lưu." />
      {!canManage && <Notice>Bạn đang ở vai trò nhân viên nên chỉ xem được.</Notice>}
      {!SETUP_API && <Notice kind="warn">Chức năng đọc ảnh chưa bật trên máy chủ. Bấm “Xem ví dụ” để xem cách bản nháp hiển thị.</Notice>}
      {saved && <Notice kind="ok">{saved}</Notice>}

      {!draft && (
        <section className="panel quick-src">
          <div className="tabs" role="tablist">
            {([['image', 'Ảnh bảng giá'], ['url', 'Link website'], ['text', 'Dán chữ']] as [Source, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={src === k} className={src === k ? 'on' : ''} onClick={() => setSrc(k)}>{l}</button>
            ))}
          </div>
          {src === 'image' && <label className="form">Chụp hoặc chọn ảnh (JPG, PNG, WebP)<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} /></label>}
          {src === 'url' && <label className="form">Link trang bảng giá / giới thiệu<input type="url" inputMode="url" placeholder="https://tiemcuaban.vn/bang-gia" value={url} onChange={e => setUrl(e.target.value)} /><small className="muted">Link Facebook cần đăng nhập nên không đọc được, hãy chụp ảnh.</small></label>}
          {src === 'text' && <label className="form">Dán bảng giá, menu<textarea rows={6} maxLength={20000} value={text} onChange={e => setText(e.target.value)} placeholder="Sơn gel tay 120k&#10;Đắp bột 250k" /></label>}
          {err && <Notice kind="err">{err}</Notice>}
          <p className="row-actions">
            <button type="button" className="btn btn-primary" disabled={!canManage || !SETUP_API || busy} onClick={send}>{busy ? 'AI đang đọc…' : 'Đọc bảng giá'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => load(SAMPLE, true)}>Xem ví dụ</button>
          </p>
          {busy && <Spinner label="AI đang đọc, thường mất 10-30 giây…" />}
        </section>
      )}

      {draft && (
        <>
          {sample && <Notice kind="warn">Đây là VÍ DỤ MẪU để xem giao diện, không phải AI đọc thật. Không lưu được.</Notice>}
          <section className="panel">
            <h2>{draft.business_name || 'Cửa hàng'} <span className="pill soft">{draft.industry_label}</span></h2>
            <p className="muted">Gọi khách là “{draft.customer_word}”{draft.opening_hours && <> · Giờ mở cửa: {draft.opening_hours}</>}</p>
            {draft.unreadable && <Notice kind="warn">AI chưa đọc chắc: {draft.unreadable}</Notice>}
          </section>
          <p className="muted">Ô màu vàng là chỗ cần anh/chị xem lại. Chỉ những dòng được tick mới được lưu. Giá luôn là giá anh/chị nhìn thấy ở đây.</p>
          <div className="table-wrap">
            <table className="table quick-table">
              <thead><tr><th>Lưu</th><th>Tên</th><th>Loại</th><th>Giá trên bảng</th><th className="num">Giá lưu (VND)</th><th className="num">Tồn kho / phút</th><th>Kiểm tra</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.check !== 'ok' ? 'needs-check' : ''}>
                    <td data-label="Lưu"><input type="checkbox" checked={r.use} onChange={e => set(i, { use: e.target.checked })} aria-label={'Lưu ' + r.name} /></td>
                    <td data-label="Tên"><input value={r.name} maxLength={80} onChange={e => set(i, { name: e.target.value })} aria-label="Tên" /></td>
                    <td data-label="Loại"><select value={r.kind} onChange={e => set(i, { kind: e.target.value as Kind })} aria-label="Loại">{(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></td>
                    <td data-label="Giá trên bảng"><code>{r.price_text || '—'}</code></td>
                    <td data-label="Giá lưu" className="num"><input inputMode="numeric" value={r.price} onChange={e => set(i, { price: e.target.value, check: 'ok' })} aria-label="Giá lưu" />{parseVnd(r.price) !== null && <small className="muted"> {vnd(parseVnd(r.price))}</small>}</td>
                    <td data-label="Tồn kho / phút" className="num">{r.kind === 'product'
                      ? <input inputMode="numeric" value={r.stock} onChange={e => set(i, { stock: e.target.value })} aria-label="Tồn kho" />
                      : <span>{r.duration_min ? r.duration_min + ' phút' : '—'}</span>}</td>
                    <td data-label="Kiểm tra">{problems[i] ? <span className="pill warn">{problems[i]}</span> : r.check === 'ok' ? <span className="pill ok">Ổn</span> : <span className="pill warn">{r.check}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draft.faqs.length > 0 && (
            <section className="panel">
              <h2>Câu hỏi thường gặp</h2>
              {draft.faqs.map((f, i) => (
                <label key={i} className="check"><input type="checkbox" checked={faqUse[i]} onChange={e => setFaqUse(u => u.map((x, k) => (k === i ? e.target.checked : x)))} /><span><b>{f.question}</b><br />{f.answer}</span></label>
              ))}
            </section>
          )}
          {needsServiceAssistant && <Notice kind="warn">Có dịch vụ nhưng chưa có trợ lý mẫu Dịch vụ. <a href="#/tro-ly">Tạo trợ lý mẫu Dịch vụ</a> trước, hoặc bỏ tick các dòng dịch vụ.</Notice>}
          {err && <Notice kind="err">{err}</Notice>}
          <p className="row-actions">
            <button type="button" className="btn btn-primary" disabled={sample || !canManage || busy || chosen.length + faqUse.filter(Boolean).length === 0 || problems.some(Boolean) || needsServiceAssistant} onClick={confirm}>{busy ? 'Đang lưu…' : `Xác nhận lưu ${chosen.length} mục`}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setDraft(null); setRows([]); }}>Làm lại</button>
          </p>
        </>
      )}
    </>
  );
}
