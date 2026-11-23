// Shared Assistant config editing (V21 Config Core contract). Used by Menu & hành động, the
// Assistant onboarding and the industry module pages, so there is exactly ONE draft writer:
// save_assistant_draft(p_assistant, p_config, p_expected_sha). Published versions are never edited;
// publish/rollback stay explicit buttons on the Menu page.
import { useEffect, useMemo, useState } from 'react';
import { friendlyError, supabase } from './supabase';
import { must, useLoad } from './data';
// Same validator / renderer the server mirrors and the bot bridge uses (config-core/lib, unit-tested).
import { ACTION_REGISTRY, HANDOFF_TEAMS, HANDOFF_DEFAULT_ACK, LABEL_MAX, MAX_MENU_ITEMS, validateConfig } from '../../../config-core/lib/action-registry.mjs';
import { CHANNEL_CAPS, render } from '../../../config-core/lib/channel-render.mjs';

export type Item = {
  id: string; action_type: string; label: string; description?: string; enabled: boolean; sort_order: number;
  action_config: Record<string, unknown>; channel_overrides?: Record<string, { label?: string; enabled?: boolean }>;
};
export type Config = { schema_version: 1; greeting: string; addressing?: { self?: string; customer?: string }; profile?: { display_name?: string; bio?: string }; menu: Item[] };
export type Assistant = { id: string; name: string; template_key: string | null; status: string; created_at: string };
export type Version = { version_no: number; state: 'draft' | 'published' | 'superseded'; config: Config; config_sha256: string; source: string; created_at: string; published_at: string | null };
export type Template = { template_key: string; name: string; industry: string; version: number };
export type Service = { name: string; price_vnd?: number | null; note?: string };

export const REG = ACTION_REGISTRY as Record<string, { status: string; title: string }>;
export const CAPS = CHANNEL_CAPS as Record<string, { mode: string; verified: boolean; maxQuick?: number; quickLabel?: number; maxPersistent?: number; persistentLabel?: number; maxButtons?: number; buttonLabel?: number }>;
export { LABEL_MAX, MAX_MENU_ITEMS, render };
export const HANDOFF_DEFAULT = HANDOFF_DEFAULT_ACK as Record<string, string>;
export const TEAM_LABEL: Record<string, string> = { sales: 'Nhân viên bán hàng', page_admin: 'Quản trị viên Fanpage', booking: 'Đội ngũ booking', consultant: 'Chuyên viên tư vấn', support: 'Chăm sóc khách hàng', manager: 'Đội ngũ quản lý' };
const LINK_KIND: Record<string, string> = { website: 'Website', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', zalo: 'Zalo' };
const ERR: Record<string, string> = {
  label_invalid: `Tên nút cần 1–${LABEL_MAX} ký tự.`, greeting_invalid: 'Lời chào cần 1–640 ký tự.', menu_too_long: `Tối đa ${MAX_MENU_ITEMS} nút.`,
  url_required: 'Cần nhập đường dẫn.', url_invalid: 'Đường dẫn chưa đúng.', url_not_https: 'Đường dẫn phải bắt đầu bằng https://',
  url_host_invalid: 'Tên miền không hợp lệ.', url_host_not_allowed: 'Đường dẫn không thuộc nền tảng đã chọn.', url_placeholder: 'Hãy thay đường dẫn mẫu bằng đường dẫn thật trước khi kích hoạt.',
  content_text_required: 'Cần nhập nội dung.', phone_invalid: 'Số điện thoại Việt Nam chưa đúng.', email_invalid: 'Email chưa đúng.',
  contact_empty: 'Nhập ít nhất một thông tin liên hệ.', services_invalid: 'Danh sách chưa hợp lệ (tên 1–80 ký tự, giá là số).',
  handoff_team_invalid: 'Chọn bộ phận nhận khách.', action_not_released: 'Chức năng này chưa phát hành, hãy tắt nút này trước khi kích hoạt.',
  menu_no_enabled_item: 'Cần bật ít nhất một nút.', config_value_invalid: 'Giá trị chưa hợp lệ.', profile_invalid: 'Thông tin giới thiệu quá dài.',
};
export const errText = (code: string) => ERR[code] ?? 'Thông tin chưa hợp lệ.';
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const resort = (menu: Item[]) => menu.map((m, i) => ({ ...m, sort_order: (i + 1) * 10 }));
export const newId = (type: string, menu: Item[]) => {
  const base = type.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'item';
  let id = base, n = 2;
  while (menu.some(m => m.id === id)) id = `${base}_${n++}`;
  return id;
};
export const DEFAULT_CFG: Record<string, Record<string, unknown>> = {
  SHOW_CONTENT: { text: '' }, OPEN_LINK: { url: '', link_kind: 'website' }, SHOW_PLAYLIST: { url: '' },
  HUMAN_HANDOFF: { team: 'sales' }, CONTACT_INFO: {}, SHOW_SERVICES: { items: [] },
};
export function newItem(type: string, menu: Item[], label?: string, cfg?: Record<string, unknown>): Item {
  return { id: newId(type, menu), action_type: type, label: (label ?? REG[type]?.title ?? type).slice(0, LABEL_MAX), enabled: true, sort_order: 0, action_config: clone(cfg ?? DEFAULT_CFG[type] ?? {}) };
}

/** Loads versions of one Assistant and gives an editable copy of the draft (or of the live config). */
export function useAssistantDraft(assistantId: string) {
  const vers = useLoad(async () => must(await supabase.from('assistant_config_versions')
    .select('version_no, state, config, config_sha256, source, created_at, published_at')
    .eq('assistant_id', assistantId).order('version_no', { ascending: false }).limit(30)) as Version[], [assistantId]);
  const draft = vers.data?.find(v => v.state === 'draft') ?? null;
  const live = vers.data?.find(v => v.state === 'published') ?? null;
  const startCfg = (draft ?? live)?.config ?? null;
  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  useEffect(() => { setCfg(startCfg ? clone(startCfg) : null); }, [startCfg]);

  const dirty = !!cfg && JSON.stringify(cfg) !== JSON.stringify(startCfg);
  const draftErrors = useMemo(() => (cfg ? validateConfig(cfg, { mode: 'draft' }).errors as { path: string; code: string }[] : []), [cfg]);
  const publishErrors = useMemo(() => (cfg ? validateConfig(cfg, { mode: 'publish' }).errors as { path: string; code: string }[] : []), [cfg]);
  const errAt = (path: string) => draftErrors.concat(publishErrors).find(e => e.path === path || e.path.startsWith(path + '.') || e.path.startsWith(path + '['));

  async function call(fn: () => PromiseLike<{ error: unknown; data?: unknown }>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      const m = String((error as { message?: string }).message ?? '');
      setMsg({ kind: 'err', text: /draft_changed/.test(m) ? 'Bản nháp vừa được người khác sửa. Hãy tải lại rồi thử lại.'
        : /invalid_config/.test(m) ? 'Máy chủ từ chối cấu hình: ' + String((error as { details?: string }).details ?? '').split('; ').slice(0, 3).map(d => errText(d.split('|')[1])).join(' ') : friendlyError(error) });
      return false;
    }
    setMsg({ kind: 'ok', text: ok }); await vers.reload(); return true;
  }
  const saveDraft = () => call(() => supabase.rpc('save_assistant_draft', { p_assistant: assistantId, p_config: cfg, p_expected_sha: draft?.config_sha256 ?? null }),
    'Đã lưu bản nháp. Khách chưa thấy thay đổi này cho tới khi bạn bấm Kích hoạt.');
  const publish = () => draft && call(() => supabase.rpc('publish_assistant_config', { p_assistant: assistantId, p_expected_sha: draft.config_sha256 }),
    'Đã kích hoạt. Các kênh đã gắn với trợ lý này dùng cấu hình mới.');
  const rollback = (v: number) => call(() => supabase.rpc('rollback_assistant_config', { p_assistant: assistantId, p_version_no: v }), `Đã kích hoạt lại nội dung phiên bản ${v}.`);
  const reset = () => startCfg && setCfg(clone(startCfg));

  return { vers, draft, live, cfg, setCfg, dirty, draftErrors, publishErrors, errAt, busy, msg, setMsg, saveDraft, publish, rollback, reset };
}
export type DraftApi = ReturnType<typeof useAssistantDraft>;

/** Draft vs Published badges: the owner always sees which one is live and which one is being edited. */
export function VersionBadges({ d }: { d: DraftApi }) {
  return (
    <div className="status-line">
      <span className={`pill ${d.live ? 'ok' : 'warn'}`}>{d.live ? `Khách đang thấy: phiên bản ${d.live.version_no}` : 'Chưa kích hoạt: khách chưa thấy trợ lý này'}</span>
      {d.draft && <span className="pill soft">Đang sửa: bản nháp {d.draft.version_no}{d.dirty ? ' · chưa lưu' : ''}</span>}
      {!d.draft && d.dirty && <span className="pill soft">Thay đổi chưa lưu</span>}
    </div>
  );
}

export function ActionFields({ it, set }: { it: Item; set: (k: string, v: unknown) => void }) {
  const c = it.action_config as Record<string, string | Service[] | undefined>;
  const s = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '');
  switch (it.action_type) {
    case 'SHOW_CATALOG': return <input aria-label="Danh mục (không bắt buộc)" placeholder="Danh mục, ví dụ: áo (để trống = tất cả)" maxLength={40} value={s('category')} onChange={e => set('category', e.target.value)} />;
    case 'FAQ': return <input aria-label="Chủ đề" placeholder="Chủ đề, ví dụ: giờ mở cửa" maxLength={60} value={s('topic')} onChange={e => set('topic', e.target.value)} />;
    case 'SHOW_CONTENT': return <><input aria-label="Tiêu đề" placeholder="Tiêu đề (không bắt buộc)" maxLength={80} value={s('title')} onChange={e => set('title', e.target.value)} /><textarea aria-label="Nội dung" rows={3} maxLength={1000} value={s('text')} onChange={e => set('text', e.target.value)} /></>;
    case 'OPEN_LINK': return (
      <div className="row2">
        <select aria-label="Loại đường dẫn" value={s('link_kind') || 'website'} onChange={e => set('link_kind', e.target.value)}>{Object.entries(LINK_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input aria-label="Đường dẫn" type="url" placeholder="https://…" maxLength={500} value={s('url')} onChange={e => set('url', e.target.value)} />
      </div>);
    case 'SHOW_PLAYLIST': return <><input aria-label="Đường dẫn YouTube" type="url" placeholder="https://www.youtube.com/…" maxLength={500} value={s('url')} onChange={e => set('url', e.target.value)} /><input aria-label="Tiêu đề danh sách" placeholder="Tiêu đề (không bắt buộc)" maxLength={80} value={s('title')} onChange={e => set('title', e.target.value)} /></>;
    case 'HUMAN_HANDOFF': return (
      <>
        <select aria-label="Bộ phận nhận khách" value={s('team')} onChange={e => set('team', e.target.value)}>{(HANDOFF_TEAMS as string[]).map(t => <option key={t} value={t}>{TEAM_LABEL[t] ?? t}</option>)}</select>
        <textarea aria-label="Câu trả lời khi chuyển" rows={2} maxLength={300} placeholder={(HANDOFF_DEFAULT_ACK as Record<string, string>)[s('team')]} value={s('ack_text')} onChange={e => set('ack_text', e.target.value)} />
      </>);
    case 'CONTACT_INFO': return (
      <div className="row2">
        <input aria-label="Điện thoại" placeholder="Điện thoại" maxLength={20} value={s('phone')} onChange={e => set('phone', e.target.value)} />
        <input aria-label="Email" placeholder="Email" maxLength={200} value={s('email')} onChange={e => set('email', e.target.value)} />
        <input aria-label="Địa chỉ" placeholder="Địa chỉ" maxLength={200} value={s('address')} onChange={e => set('address', e.target.value)} />
        <input aria-label="Giờ làm việc" placeholder="Giờ làm việc" maxLength={120} value={s('hours')} onChange={e => set('hours', e.target.value)} />
      </div>);
    case 'SHOW_SERVICES': {
      const items = Array.isArray(c.items) ? (c.items as Service[]) : [];
      const put = (next: Service[]) => set('items', next);
      return (
        <div className="services">
          {items.map((sv, j) => (
            <div key={j} className="row2 svc-row">
              <input aria-label="Tên" placeholder="Tên" maxLength={80} value={sv.name} onChange={e => put(items.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Giá (đồng)" inputMode="numeric" placeholder="Giá, để trống nếu liên hệ" value={sv.price_vnd ?? ''}
                onChange={e => { const d = e.target.value.replace(/\D/g, ''); put(items.map((x, k) => (k === j ? { ...x, price_vnd: d ? Number(d) : null } : x))); }} />
              <button type="button" className="link-btn" onClick={() => put(items.filter((_, k) => k !== j))}>Xoá</button>
            </div>
          ))}
          {items.length < 20 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => put([...items, { name: '' }])}>+ Thêm dòng</button>}
          {!items.length && <small className="muted">Chưa có mục nào. Trợ lý sẽ nói là chưa có thông tin, không tự bịa giá.</small>}
        </div>);
    }
    case 'BOOKING_REQUEST': return <small className="muted">Tiếp nhận lịch hẹn chưa phát hành: lưu được ở bản nháp nhưng chưa kích hoạt được. Khách sẽ được chuyển nhân viên xác nhận lịch thật.</small>;
    default: return null;
  }
}

type Rendered = { greeting?: string; text?: string; greeting_message?: { text: string; quick_replies: { title: string }[] }; persistent_menu?: { call_to_actions: { title: string; type: string }[] }[]; buttons?: { label: string; kind: string }[]; warnings: { code: string }[] };

/** What the customer sees on one channel. device=mobile shows the Messenger phone reality (☰ may be hidden). */
export function Preview({ r: raw, device = 'desktop' }: { r: unknown; device?: 'mobile' | 'desktop' }) {
  const r = raw as Rendered;
  return (
    <div className={`chat-preview ${device}`} aria-label="Khách sẽ thấy">
      {r.greeting_message && <>
        <p className="bubble">{r.greeting_message.text}</p>
        <div className="chips">{r.greeting_message.quick_replies.map((q, i) => <span key={i} className="chip">{q.title}</span>)}</div>
        {device === 'desktop'
          ? <p className="fine muted">Menu ☰: {r.persistent_menu?.[0].call_to_actions.map(a => a.title + (a.type === 'web_url' ? ' ↗' : '')).join(' · ') || 'trống'}</p>
          : <p className="fine muted">Trên ứng dụng điện thoại, menu ☰ có thể không hiện. Khách bấm các nút trả lời nhanh ở trên; nút mở đường dẫn chỉ nằm trong menu ☰.</p>}
      </>}
      {r.buttons && <>
        <p className="bubble">{r.greeting}</p>
        <div className="chips">{r.buttons.map((b, i) => <span key={i} className="chip">{b.label}{b.kind === 'link' ? ' ↗' : ''}</span>)}</div>
      </>}
      {r.text && !r.greeting_message && !r.buttons && <p className="bubble pre">{r.text}</p>}
      {r.warnings.length > 0 && <p className="fine muted">Có nút bị cắt ngắn tên hoặc bị lược bớt trên kênh này.</p>}
    </div>
  );
}

export const PREVIEW_CHANNELS: [string, string][] = [['messenger', 'Messenger'], ['web', 'Website'], ['zalo_bot', 'Zalo'], ['telegram', 'Telegram']];
