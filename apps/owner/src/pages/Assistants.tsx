import { useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature, must, useLoad } from '../data';
import { dateTime } from '../format';
import { Config, Template } from '../assistant';
import { industryFromTemplate, INDUSTRY_META, useWorkspace } from '../workspace';
import { Empty, Notice, PageHead, Spinner } from '../ui';

type Row = { id: string; name: string; template_key: string | null; created_at: string };
type VerRow = { assistant_id: string; version_no: number; state: string; published_at: string | null; created_at: string };
type Conn = { assistant_id: string | null; channel: string; status: string; environment: string };

const STEPS = ['Mẫu ngành', 'Tên & phong cách', 'Kiến thức', 'Menu & hành động', 'Kênh kết nối', 'Xem trước & kích hoạt'];
const ADDRESSING: [string, string, string][] = [
  ['mình', 'bạn', 'Mình – bạn (thân thiện)'], ['em', 'anh/chị', 'Em – anh/chị (lễ phép)'],
  ['shop', 'bạn', 'Shop – bạn (cửa hàng)'], ['chúng tôi', 'quý khách', 'Chúng tôi – quý khách (trang trọng)'],
];

export function Assistants() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const [creating, setCreating] = useState(false);
  const data = useLoad(async () => {
    const [a, v, c, t] = await Promise.all([
      supabase.from('assistants').select('id, name, template_key, created_at').eq('store_id', store.id).order('created_at'),
      supabase.from('assistant_config_versions').select('assistant_id, version_no, state, published_at, created_at').eq('store_id', store.id).in('state', ['draft', 'published']),
      supabase.from('channel_connections').select('assistant_id, channel, status, environment').eq('store_id', store.id),
      supabase.from('industry_templates').select('template_key, name, industry, version').order('template_key'),
    ]);
    return { assistants: must(a) as Row[], versions: must(v) as VerRow[], conns: (c.error ? [] : c.data) as Conn[], templates: must(t) as Template[] };
  }, [store.id]);

  if (data.loading) return <Spinner />;
  if (data.error) return <><PageHead title="Trợ lý AI" /><Notice kind={isMissingFeature(data.error) ? 'warn' : 'err'}>{isMissingFeature(data.error) ? 'Trợ lý AI chưa được bật trên máy chủ cho Workspace này.' : friendlyError(data.error)}</Notice></>;
  const { assistants, versions, conns, templates } = data.data!;
  const showWizard = creating || (!assistants.length && canManage);

  return (
    <>
      <PageHead title="Trợ lý AI" sub={`Các trợ lý của ${store.name}. Mỗi trợ lý có cấu hình, phiên bản và kênh riêng.`}
        actions={canManage && !showWizard && assistants.length < 10 ? <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Tạo trợ lý</button> : undefined} />
      {!canManage && <Notice>Bạn đang ở vai trò nhân viên nên chỉ xem được danh sách trợ lý.</Notice>}
      {showWizard && <Wizard templates={templates} onCancel={assistants.length ? () => setCreating(false) : undefined}
        onDone={async () => { setCreating(false); await Promise.all([data.reload(), ws.reload()]); }} />}
      {!assistants.length && !canManage && <Empty title="Chưa có trợ lý nào">Chủ sở hữu hoặc quản lý có thể tạo trợ lý từ một mẫu ngành.</Empty>}
      {assistants.length > 0 && (
        <div className="assistant-grid">
          {assistants.map(a => {
            const ind = industryFromTemplate(a.template_key);
            const live = versions.find(v => v.assistant_id === a.id && v.state === 'published');
            const draft = versions.find(v => v.assistant_id === a.id && v.state === 'draft');
            const ch = conns.filter(c => c.assistant_id === a.id);
            return (
              <article key={a.id} className="panel assistant-card">
                <header><span className="ico" aria-hidden="true">{ind ? INDUSTRY_META[ind].icon : '✦'}</span><div><h2>{a.name}</h2><small className="muted">Mẫu {ind ? INDUSTRY_META[ind].label : 'tùy chỉnh'} · tạo {dateTime(a.created_at)}</small></div></header>
                <div className="status-line">
                  {live ? <span className="pill ok">Đang chạy: phiên bản {live.version_no}</span> : <span className="pill warn">Chưa kích hoạt</span>}
                  {draft && <span className="pill soft">Có bản nháp {draft.version_no}</span>}
                  <span className="pill">{ch.length ? `${ch.length} kênh đã gắn` : 'Chưa gắn kênh'}</span>
                </div>
                <div className="row-actions">
                  <a className="btn btn-ghost btn-sm" href={`#/menu-tro-ly?a=${a.id}`}>Menu & hành động</a>
                  {ind && ind !== 'shop' && <a className="btn btn-ghost btn-sm" href={`#${INDUSTRY_META[ind].modules[0].path}`}>{INDUSTRY_META[ind].modules[0].label}</a>}
                  <a className="btn btn-ghost btn-sm" href="#/kenh-ban">Kênh</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <section className="panel">
        <h2>Quy trình thiết lập trợ lý</h2>
        <ol className="flow">
          <li className="done"><b>Tạo Workspace</b><span>{store.name}</span></li>
          {STEPS.map((s, i) => <li key={s} className={assistants.length && i < 1 ? 'done' : ''}><b>{s}</b><span>{STEP_HINT[i]}</span></li>)}
        </ol>
        <p className="fine muted">Mọi thay đổi được lưu ở bản nháp. Chỉ chủ sở hữu hoặc quản lý mới kích hoạt được, và bản đang chạy không bao giờ bị sửa ngầm.</p>
      </section>
    </>
  );
}

const STEP_HINT = [
  'Cửa hàng, nghệ sĩ, dịch vụ hoặc giáo dục.',
  'Tên trợ lý, tên hiển thị với khách, cách xưng hô, lời chào.',
  'Câu hỏi thường gặp, thông tin giới thiệu, điều không được hứa.',
  'Đổi tên, thứ tự, bật tắt nút; mã hành động không đổi.',
  'Xem khả năng và trạng thái từng kênh.',
  'Xem trên điện thoại/máy tính rồi bấm Kích hoạt.',
];

function Wizard({ templates, onCancel, onDone }: { templates: Template[]; onCancel?: () => void; onDone: () => Promise<void> }) {
  const { store } = useStore();
  const ws = useWorkspace();
  const preferred = templates.find(t => t.template_key === ws.primary)?.template_key ?? templates[0]?.template_key ?? 'shop';
  const [step, setStep] = useState(0);
  const [tpl, setTpl] = useState(preferred);
  const [name, setName] = useState('Trợ lý của ' + store.name);
  const [display, setDisplay] = useState(store.name);
  const [addr, setAddr] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<string | null>(null);

  async function create() {
    setBusy(true); setErr('');
    const r = await supabase.rpc('create_assistant', { p_store: store.id, p_name: name.trim(), p_template_key: tpl });
    if (r.error) { setBusy(false); return setErr(friendlyError(r.error)); }
    const id = r.data as string;
    // The template draft (v1) is created server-side; personalise it with one more draft save.
    const v = await supabase.from('assistant_config_versions').select('config, config_sha256').eq('assistant_id', id).eq('state', 'draft').maybeSingle();
    if (!v.error && v.data) {
      const cfg = v.data.config as Config;
      const [self, customer] = ADDRESSING[addr];
      const next: Config = { ...cfg, addressing: { self, customer }, profile: { ...cfg.profile, display_name: display.trim() || undefined }, greeting: greeting.trim() || cfg.greeting };
      const s = await supabase.rpc('save_assistant_draft', { p_assistant: id, p_config: next, p_expected_sha: v.data.config_sha256 });
      if (s.error) setErr('Đã tạo trợ lý nhưng chưa lưu được tên hiển thị/lời chào: ' + friendlyError(s.error));
    }
    setBusy(false); setCreated(id); setStep(2);
  }

  const ind = industryFromTemplate(tpl);
  return (
    <section className="panel wizard" aria-label="Tạo trợ lý">
      <ol className="wizard-steps">{STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>)}</ol>
      {step === 0 && <>
        <h2>Chọn mẫu ngành</h2>
        <p className="muted">Mẫu chỉ là điểm bắt đầu: không có sẵn giá, tồn kho, tiểu sử hay thông tin thật nào. Đường dẫn mẫu bị tắt cho tới khi bạn nhập đường dẫn thật.</p>
        <div className="tones">
          {templates.map(t => {
            const i = industryFromTemplate(t.template_key);
            return (
              <label key={t.template_key} className={`tone${tpl === t.template_key ? ' on' : ''}`}>
                <input type="radio" name="tpl" checked={tpl === t.template_key} onChange={() => setTpl(t.template_key)} />
                <b>{i ? INDUSTRY_META[i].icon + ' ' : ''}{t.name}</b><span className="muted">Mẫu v{t.version}</span>
              </label>
            );
          })}
        </div>
        <div className="form-foot">{onCancel && <button className="btn btn-ghost" onClick={onCancel}>Huỷ</button>}<button className="btn btn-primary" onClick={() => setStep(1)}>Tiếp tục</button></div>
      </>}
      {step === 1 && <div className="form">
        <h2>Tên &amp; phong cách</h2>
        <div className="row2">
          <label>Tên trợ lý (chỉ bạn thấy)<input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>
          <label>Tên hiển thị với khách<input value={display} maxLength={100} onChange={e => setDisplay(e.target.value)} placeholder={ind === 'artist' ? 'Nghệ danh hoặc tên trang' : 'Tên tổ chức'} /></label>
        </div>
        <label>Cách xưng hô
          <select value={addr} onChange={e => setAddr(Number(e.target.value))}>{ADDRESSING.map((a, i) => <option key={a[2]} value={i}>{a[2]}</option>)}</select>
        </label>
        <label>Lời chào (để trống = dùng lời chào của mẫu)<textarea rows={2} maxLength={640} value={greeting} onChange={e => setGreeting(e.target.value)} /></label>
        {ind === 'artist' && <Notice>Trợ lý nói thay đội ngũ của nghệ sĩ, không giả làm nghệ sĩ và không hứa nghệ sĩ trực tiếp trả lời.</Notice>}
        {err && <Notice kind="err">{err}</Notice>}
        <div className="form-foot"><button className="btn btn-ghost" onClick={() => setStep(0)} disabled={busy}>Quay lại</button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo trợ lý (bản nháp)'}</button></div>
      </div>}
      {step >= 2 && created && <>
        <h2>Đã tạo bản nháp</h2>
        {err ? <Notice kind="warn">{err}</Notice> : <Notice kind="ok">Trợ lý đã được tạo ở trạng thái bản nháp. Khách chưa thấy gì cho tới khi bạn kích hoạt.</Notice>}
        <ol className="next-links">
          <li><a href="#/tri-thuc">Thiết lập kho kiến thức</a><span className="muted"> · câu hỏi thường gặp, thông tin giới thiệu</span></li>
          {ind && ind !== 'shop' && <li><a href={`#${INDUSTRY_META[ind].modules[0].path}`}>{INDUSTRY_META[ind].modules[0].label}</a><span className="muted"> · nội dung riêng của ngành</span></li>}
          {ind === 'shop' && <li><a href="#/san-pham">Nhập sản phẩm, giá, tồn kho</a></li>}
          <li><a href={`#/menu-tro-ly?a=${created}`}>Chỉnh menu &amp; hành động, xem trước, kích hoạt</a></li>
          <li><a href="#/kenh-ban">Xem kênh kết nối</a></li>
        </ol>
        <div className="form-foot"><button className="btn btn-primary" onClick={onDone}>Xong</button></div>
      </>}
    </section>
  );
}
