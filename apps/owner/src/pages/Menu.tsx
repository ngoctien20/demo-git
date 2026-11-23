import { useMemo, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature, must, useLoad } from '../data';
import { dateTime } from '../format';
import { useRoute } from '../router';
import { Empty, Notice, PageHead, Spinner } from '../ui';
import {
  ActionFields, Assistant, CAPS, errText, Item, LABEL_MAX, MAX_MENU_ITEMS, newItem, Preview, PREVIEW_CHANNELS, REG, render, resort,
  Template, useAssistantDraft, VersionBadges,
} from '../assistant';

export function Menu() {
  const { store, canManage } = useStore();
  const route = useRoute();
  const [picked, setPicked] = useState<string | null>(route.query.get('a'));
  const base = useLoad(async () => {
    const [a, t] = await Promise.all([
      supabase.from('assistants').select('id, name, template_key, status, created_at').eq('store_id', store.id).order('created_at'),
      supabase.from('industry_templates').select('template_key, name, industry, version').order('template_key'),
    ]);
    return { assistants: must(a) as Assistant[], templates: must(t) as Template[] };
  }, [store.id]);
  const assistant = base.data?.assistants.find(a => a.id === picked) ?? base.data?.assistants[0] ?? null;

  if (base.loading) return <Spinner />;
  if (base.error) return <><PageHead title="Menu & hành động" /><Notice kind={isMissingFeature(base.error) ? 'warn' : 'err'}>{isMissingFeature(base.error) ? 'Menu trợ lý chưa được bật trên máy chủ. Đội TIEN404 sẽ mở trong đợt cập nhật tới.' : friendlyError(base.error)}</Notice></>;
  const { assistants, templates } = base.data!;

  return (
    <>
      <PageHead title="Menu & hành động" sub={`Các nút khách thấy khi nhắn cho ${store.name}. Tên nút do bạn đặt; mã hành động cố định. Sửa ở bản nháp, bấm Kích hoạt khi đã ổn.`}
        actions={assistants.length > 1 ? (
          <select aria-label="Chọn trợ lý" value={assistant?.id} onChange={e => setPicked(e.target.value)}>
            {assistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>) : undefined} />
      {!canManage && <Notice>Bạn đang ở vai trò nhân viên nên chỉ xem được menu.</Notice>}
      {assistant
        ? <Editor key={assistant.id} assistant={assistant} canManage={canManage} initialChannel={route.query.get('kenh')} />
        : <CreateAssistant templates={templates} canManage={canManage} onCreated={async id => { await base.reload(); setPicked(id); }} />}
    </>
  );
}

function CreateAssistant({ templates, canManage, onCreated }: { templates: Template[]; canManage: boolean; onCreated: (id: string) => void }) {
  const { store } = useStore();
  const [name, setName] = useState('Trợ lý của ' + store.name);
  const [tpl, setTpl] = useState(templates[0]?.template_key ?? 'shop');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!canManage) return <Empty title="Chưa có trợ lý nào">Chủ sở hữu hoặc quản lý có thể tạo trợ lý từ một mẫu ngành.</Empty>;
  async function create() {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('create_assistant', { p_store: store.id, p_name: name.trim(), p_template_key: tpl });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onCreated(data as string);
  }
  return (
    <section className="panel form">
      <h2>Tạo trợ lý từ mẫu ngành</h2>
      <p className="muted">Mẫu chỉ là điểm bắt đầu: không có sẵn giá, tồn kho hay thông tin thật nào. Bạn sửa tên nút, bật hoặc tắt nút rồi mới kích hoạt.</p>
      <label>Tên trợ lý<input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>
      <div className="tones">
        {templates.map(t => (
          <label key={t.template_key} className={`tone${tpl === t.template_key ? ' on' : ''}`}>
            <input type="radio" name="tpl" checked={tpl === t.template_key} onChange={() => setTpl(t.template_key)} />
            <b>{t.name}</b><span className="muted">Mẫu v{t.version}</span>
          </label>
        ))}
      </div>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="form-foot"><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo trợ lý'}</button></div>
    </section>
  );
}

function Editor({ assistant, canManage, initialChannel }: { assistant: Assistant; canManage: boolean; initialChannel: string | null }) {
  const d = useAssistantDraft(assistant.id);
  const { cfg, setCfg, vers, draft, dirty, draftErrors, publishErrors, errAt, busy, msg } = d;
  const [channel, setChannel] = useState(initialChannel && PREVIEW_CHANNELS.some(c => c[0] === initialChannel) ? initialChannel : 'messenger');
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const preview = useMemo(() => (cfg && !draftErrors.length ? render(cfg, channel) : null), [cfg, channel, draftErrors.length]);
  const fallback = useMemo(() => (cfg && !draftErrors.length && CAPS[channel]?.mode !== 'text' ? render(cfg, 'telegram') as { text?: string } : null), [cfg, channel, draftErrors.length]);

  if (vers.loading || (vers.data?.length && !cfg)) return <Spinner />;
  if (vers.error) return <Notice kind="err">{friendlyError(vers.error)}</Notice>;
  if (!cfg) return <Notice kind="warn">Trợ lý này chưa có cấu hình.</Notice>;

  const set = (patch: Partial<typeof cfg>) => setCfg({ ...cfg, ...patch });
  const setItem = (i: number, patch: Partial<Item>) => set({ menu: cfg.menu.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setAc = (i: number, k: string, v: unknown) => {
    const ac = { ...cfg.menu[i].action_config };
    if (v === '' || v === undefined) delete ac[k]; else ac[k] = v;
    setItem(i, { action_config: ac });
  };
  const move = (i: number, dir: -1 | 1) => {
    const m = [...cfg.menu]; const j = i + dir;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j], m[i]]; set({ menu: resort(m) });
  };
  const add = (type: string) => {
    if (!type || cfg.menu.length >= MAX_MENU_ITEMS) return;
    set({ menu: resort([...cfg.menu, newItem(type, cfg.menu)]) });
  };
  const rollback = (v: number) => {
    if (!window.confirm(`Kích hoạt lại phiên bản ${v}? Bản đang chạy vẫn được lưu trong lịch sử.`)) return;
    d.rollback(v);
  };
  const caps = CAPS[channel];

  const ro = !canManage || busy;
  return (
    <div className="grid2 menu-editor">
      <div>
        <section className="panel form">
          <VersionBadges d={d} />
          <fieldset disabled={ro}>
            <label>Lời chào khi khách bắt đầu
              <textarea rows={3} maxLength={640} value={cfg.greeting} onChange={e => set({ greeting: e.target.value })} />
              {errAt('greeting') && <small className="danger-text">{errText(errAt('greeting')!.code)}</small>}
            </label>
            <div className="row2">
              <label>Giới thiệu: tên hiển thị<input maxLength={100} value={cfg.profile?.display_name ?? ''} onChange={e => set({ profile: { ...cfg.profile, display_name: e.target.value || undefined } })} /></label>
              <label>Giới thiệu ngắn<input maxLength={1000} value={cfg.profile?.bio ?? ''} onChange={e => set({ profile: { ...cfg.profile, bio: e.target.value || undefined } })} /></label>
            </div>
            <h2>Các nút ({cfg.menu.length}/{MAX_MENU_ITEMS})</h2>
            <ol className="plain menu-items">
              {cfg.menu.map((it, i) => (
                <li key={it.id} className={`menu-item${it.enabled ? '' : ' off'}`}>
                  <div className="menu-item-head">
                    <input aria-label="Tên nút" value={it.label} maxLength={LABEL_MAX} onChange={e => setItem(i, { label: e.target.value })} />
                    <button type="button" role="switch" aria-checked={it.enabled} className={`switch${it.enabled ? ' on' : ''}`} onClick={() => setItem(i, { enabled: !it.enabled })}><span className="sr">Bật hoặc tắt nút {it.label}</span></button>
                  </div>
                  <small className="muted action-id">{REG[it.action_type]?.title ?? it.action_type}{REG[it.action_type]?.status !== 'released' ? ' · sắp có' : ''} · mã nút <code>{it.id}</code> · hành động <code>{it.action_type}</code></small>
                  <ActionFields it={it} set={(k, v) => setAc(i, k, v)} />
                  {errAt(`menu[${i}]`) && <small className="danger-text">{errText(errAt(`menu[${i}]`)!.code)}</small>}
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa ${it.label} lên trên`}>↑</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === cfg.menu.length - 1} aria-label={`Đưa ${it.label} xuống dưới`}>↓</button>
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => set({ menu: resort(cfg.menu.filter((_, j) => j !== i)) })}>Xoá nút</button>
                  </div>
                </li>
              ))}
            </ol>
            {cfg.menu.length < MAX_MENU_ITEMS && (
              <label>Thêm nút
                <select value="" onChange={e => add(e.target.value)}>
                  <option value="">Chọn hành động…</option>
                  {Object.entries(REG).map(([k, x]) => <option key={k} value={k}>{x.title}{x.status !== 'released' ? ' (sắp có, chỉ lưu nháp)' : ''}</option>)}
                </select>
              </label>
            )}
          </fieldset>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          {canManage && (
            <div className="form-foot">
              <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={d.reset}>Hoàn tác</button>
              <button type="button" className="btn" disabled={!dirty || busy || draftErrors.length > 0} onClick={d.saveDraft}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button>
              <button type="button" className="btn btn-primary" disabled={!draft || dirty || busy || publishErrors.length > 0} onClick={d.publish}
                title={dirty ? 'Lưu nháp trước khi kích hoạt' : publishErrors.length ? errText(publishErrors[0].code) : undefined}>Kích hoạt</button>
            </div>
          )}
          {canManage && !dirty && draft && publishErrors.length > 0 && <Notice kind="warn">Chưa kích hoạt được: {errText(publishErrors[0].code)}</Notice>}
        </section>
      </div>
      <div>
        <section className="panel">
          <h2>Xem trước</h2>
          <div className="tabs" role="tablist" aria-label="Kênh xem trước">
            {PREVIEW_CHANNELS.map(([v, l]) => <button key={v} role="tab" aria-selected={channel === v} className={channel === v ? 'on' : ''} onClick={() => setChannel(v)}>{l}</button>)}
          </div>
          <div className="tabs small" role="tablist" aria-label="Thiết bị">
            <button role="tab" aria-selected={device === 'mobile'} className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')}>Điện thoại</button>
            <button role="tab" aria-selected={device === 'desktop'} className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')}>Máy tính</button>
          </div>
          {preview ? <Preview r={preview} device={device} /> : <p className="muted">Sửa các lỗi bên trái để xem trước.</p>}
          <p className="fine muted">
            {caps?.mode === 'text' ? 'Kênh này chỉ hiển thị chữ: menu thành danh sách đánh số, khách gõ số để chọn.'
              : channel === 'messenger' ? `Messenger: tối đa ${caps?.maxQuick} nút trả lời nhanh (${caps?.quickLabel} ký tự), menu ☰ tối đa ${caps?.maxPersistent} mục (${caps?.persistentLabel} ký tự).`
                : `Website: tối đa ${caps?.maxButtons} nút, ${caps?.buttonLabel} ký tự mỗi nút.`}
            {caps && !caps.verified ? ' Kênh này chưa được kiểm thử menu thật.' : ''}
          </p>
          {fallback?.text && (
            <details className="fallback">
              <summary>Dự phòng khi kênh không hiện được nút</summary>
              <p className="bubble pre">{fallback.text}</p>
            </details>
          )}
          <p className="fine muted">Menu cố định ☰ trên Fanpage thật chỉ được đổi ở bước riêng có duyệt. Kích hoạt ở đây áp dụng cho kênh đã gắn với trợ lý này.</p>
        </section>
        <section className="panel">
          <h2>Lịch sử phiên bản</h2>
          <ul className="plain versions">
            {(vers.data ?? []).map(v => (
              <li key={v.version_no}>
                <b>v{v.version_no}</b> <span className={`pill ${v.state === 'published' ? 'ok' : v.state === 'draft' ? 'soft' : ''}`}>{v.state === 'published' ? 'Đang chạy' : v.state === 'draft' ? 'Nháp' : 'Đã thay'}</span>
                <small className="muted"> {dateTime(v.published_at ?? v.created_at)}{v.source.startsWith('rollback:') ? ` · khôi phục từ ${v.source.slice(9)}` : v.source.startsWith('template:') ? ' · từ mẫu' : ''}</small>
                {canManage && v.state === 'superseded' && <button type="button" className="link-btn" disabled={busy} onClick={() => rollback(v.version_no)}>Kích hoạt lại</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
