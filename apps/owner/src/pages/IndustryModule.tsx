// Industry module pages (Artist / Service / Education). They edit the SAME assistant draft as the
// Menu page (save_assistant_draft), focused on the items that matter for the industry. No new table,
// no new RPC: everything is stored in the V21 assistant config and only reaches customers after the
// owner presses Kích hoạt on the Menu page.
import { useMemo } from 'react';
import { friendlyError } from '../supabase';
import { useStore } from '../store';
import { ActionFields, Config, errText, Item, MAX_MENU_ITEMS, newItem, REG, resort, useAssistantDraft, VersionBadges } from '../assistant';
import { Industry, INDUSTRY_META, industryFromTemplate, useWorkspace } from '../workspace';
import { Empty, Notice, PageHead, Spinner } from '../ui';

type Slot = { key: string; title: string; hint: string; type: string; match: (it: Item) => boolean; label: string; cfg?: Record<string, unknown> };
type Planned = { title: string; hint: string };

const SLOTS: Record<Exclude<Industry, 'shop'>, { intro: string; slots: Slot[]; planned: Planned[] }> = {
  artist: {
    intro: 'Hồ sơ nghệ sĩ, nhạc, kênh YouTube, nội dung nổi bật và liên hệ quản lý. Trợ lý chỉ nói những gì bạn nhập ở đây.',
    slots: [
      { key: 'music', title: 'Nghe nhạc', hint: 'Danh sách phát YouTube hoặc YouTube Music.', type: 'SHOW_PLAYLIST', label: 'Nghe nhạc', match: it => it.action_type === 'SHOW_PLAYLIST' },
      { key: 'profile', title: 'Thông tin nghệ sĩ', hint: 'Hiển thị tên hiển thị và tiểu sử ở trên.', type: 'SHOW_PROFILE', label: 'Thông tin nghệ sĩ', match: it => it.action_type === 'SHOW_PROFILE' },
      { key: 'youtube', title: 'Kênh YouTube', hint: 'Đường dẫn https://www.youtube.com/@…', type: 'OPEN_LINK', label: 'Kênh YouTube', cfg: { url: '', link_kind: 'youtube' }, match: it => it.action_type === 'OPEN_LINK' && it.action_config.link_kind === 'youtube' },
      { key: 'highlight', title: 'Nội dung nổi bật', hint: 'Bài hát mới, dự án, thông báo ngắn.', type: 'SHOW_CONTENT', label: 'Nội dung nổi bật', cfg: { title: 'Nổi bật', text: '' }, match: it => it.action_type === 'SHOW_CONTENT' },
      { key: 'manager', title: 'Liên hệ quản lý', hint: 'Khách được chuyển tới đội ngũ quản lý hoặc booking.', type: 'HUMAN_HANDOFF', label: 'Liên hệ quản lý', cfg: { team: 'manager' }, match: it => it.action_type === 'HUMAN_HANDOFF' },
    ],
    planned: [{ title: 'Lịch biểu diễn', hint: 'Chưa có nơi lưu lịch có cấu trúc. Tạm thời dùng "Nội dung nổi bật" và tự cập nhật; trợ lý không tự đoán lịch.' },
      { title: 'Tương tác người hâm mộ (biểu cảm tự động)', hint: 'Mặc định tắt. Xem Phong cách & biểu cảm.' }],
  },
  service: {
    intro: 'Danh sách dịch vụ, giờ làm việc, liên hệ và chuyển chuyên viên. Đặt lịch tự động chưa hoạt động.',
    slots: [
      { key: 'services', title: 'Danh sách dịch vụ', hint: 'Tên và giá (để trống giá nếu cần báo riêng).', type: 'SHOW_SERVICES', label: 'Xem dịch vụ', match: it => it.action_type === 'SHOW_SERVICES' },
      { key: 'contact', title: 'Giờ làm việc & liên hệ', hint: 'Địa chỉ, điện thoại, email, giờ làm việc.', type: 'CONTACT_INFO', label: 'Giờ làm việc & liên hệ', match: it => it.action_type === 'CONTACT_INFO' },
      { key: 'booking', title: 'Yêu cầu đặt lịch', hint: 'Hành động "sắp có": lưu được ở bản nháp, chưa kích hoạt được.', type: 'BOOKING_REQUEST', label: 'Đặt lịch tư vấn', match: it => it.action_type === 'BOOKING_REQUEST' },
      { key: 'consultant', title: 'Chuyển tư vấn viên', hint: 'Bộ phận nhận khách khi cần người thật.', type: 'HUMAN_HANDOFF', label: 'Gặp chuyên viên', cfg: { team: 'consultant' }, match: it => it.action_type === 'HUMAN_HANDOFF' },
    ],
    planned: [{ title: 'Lịch hẹn thật (giờ trống, xác nhận tự động)', hint: 'Cần backend lịch hẹn riêng. Hiện nhân viên xác nhận lịch thủ công.' }],
  },
  education: {
    intro: 'Khóa học, tuyển sinh, tài liệu và tư vấn viên. Câu hỏi tuyển sinh nhập ở Kho kiến thức.',
    slots: [
      { key: 'courses', title: 'Khóa học & học phí', hint: 'Tên khóa và học phí bạn công bố.', type: 'SHOW_SERVICES', label: 'Xem khóa học', match: it => it.action_type === 'SHOW_SERVICES' },
      { key: 'faq', title: 'Hỏi đáp tuyển sinh', hint: 'Nút dẫn vào chủ đề trong Kho kiến thức.', type: 'FAQ', label: 'Hỏi tuyển sinh', cfg: { topic: 'tuyển sinh' }, match: it => it.action_type === 'FAQ' },
      { key: 'docs', title: 'Hướng dẫn học viên / tài liệu', hint: 'Đường dẫn HTTPS tới tài liệu.', type: 'OPEN_LINK', label: 'Tài liệu', match: it => it.action_type === 'OPEN_LINK' },
      { key: 'advisor', title: 'Tư vấn chương trình', hint: 'Chuyển tư vấn viên.', type: 'HUMAN_HANDOFF', label: 'Gặp tư vấn viên', cfg: { team: 'consultant' }, match: it => it.action_type === 'HUMAN_HANDOFF' },
    ],
    planned: [{ title: 'Lịch khai giảng có cấu trúc', hint: 'Dự kiến. Tạm thời ghi trong mô tả khóa học hoặc Kho kiến thức.' }],
  },
};

export function IndustryModule({ industry }: { industry: Exclude<Industry, 'shop'> }) {
  const ws = useWorkspace();
  const { canManage } = useStore();
  const meta = INDUSTRY_META[industry];
  const assistant = ws.assistants.find(a => industryFromTemplate(a.template_key) === industry);
  return (
    <>
      <PageHead title={meta.modules[0].label} sub={SLOTS[industry].intro} />
      {!ws.assistantsReady ? <Notice kind="warn">Chưa tải được trợ lý của Workspace này.</Notice>
        : !assistant ? <Empty title={`Chưa có trợ lý mẫu ${meta.short}`}>{canManage ? <a className="btn btn-primary" href="#/tro-ly">Tạo trợ lý mẫu {meta.short}</a> : 'Chủ sở hữu hoặc quản lý có thể tạo trợ lý.'}</Empty>
          : <ModuleEditor key={assistant.id} id={assistant.id} name={assistant.name} industry={industry} canManage={canManage} />}
      <section className="panel">
        <h2>Chưa có trong phiên bản này</h2>
        <ul className="plain planned-list">{SLOTS[industry].planned.map(p => <li key={p.title}><b>{p.title}</b> <span className="pill">Dự kiến</span><br /><small className="muted">{p.hint}</small></li>)}</ul>
      </section>
    </>
  );
}

function ModuleEditor({ id, name, industry, canManage }: { id: string; name: string; industry: Exclude<Industry, 'shop'>; canManage: boolean }) {
  const d = useAssistantDraft(id);
  const { cfg, setCfg, vers, draft, dirty, draftErrors, errAt, busy, msg } = d;
  const slots = SLOTS[industry].slots;
  const index = useMemo(() => Object.fromEntries(slots.map(s => [s.key, cfg ? cfg.menu.findIndex(s.match) : -1])), [cfg, slots]);
  if (vers.loading || (vers.data?.length && !cfg)) return <Spinner />;
  if (vers.error) return <Notice kind="err">{friendlyError(vers.error)}</Notice>;
  if (!cfg) return <Notice kind="warn">Trợ lý này chưa có cấu hình.</Notice>;

  const set = (patch: Partial<Config>) => setCfg({ ...cfg, ...patch });
  const setItem = (i: number, patch: Partial<Item>) => set({ menu: cfg.menu.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setAc = (i: number, k: string, v: unknown) => {
    const ac = { ...cfg.menu[i].action_config };
    if (v === '' || v === undefined) delete ac[k]; else ac[k] = v;
    setItem(i, { action_config: ac });
  };
  const addSlot = (s: Slot) => {
    if (cfg.menu.length >= MAX_MENU_ITEMS) return;
    const it = newItem(s.type, cfg.menu, s.label, s.cfg);
    if (REG[s.type]?.status !== 'released') it.enabled = false;
    set({ menu: resort([...cfg.menu, it]) });
  };
  const ro = !canManage || busy;

  return (
    <>
      <section className="panel form">
        <p className="muted">Trợ lý: <b>{name}</b> · <a href={`#/menu-tro-ly?a=${id}`}>mở Menu &amp; hành động để xem trước và kích hoạt</a></p>
        <VersionBadges d={d} />
        <fieldset disabled={ro}>
          <div className="row2">
            <label>{industry === 'artist' ? 'Nghệ danh / tên hiển thị' : 'Tên hiển thị'}<input maxLength={100} value={cfg.profile?.display_name ?? ''} onChange={e => set({ profile: { ...cfg.profile, display_name: e.target.value || undefined } })} /></label>
            <label>{industry === 'artist' ? 'Tiểu sử ngắn' : 'Giới thiệu ngắn'}<textarea rows={3} maxLength={1000} value={cfg.profile?.bio ?? ''} onChange={e => set({ profile: { ...cfg.profile, bio: e.target.value || undefined } })} /></label>
          </div>
        </fieldset>
      </section>
      <div className="slot-grid">
        {slots.map(s => {
          const i = index[s.key];
          const it = i >= 0 ? cfg.menu[i] : null;
          const released = REG[s.type]?.status === 'released';
          return (
            <section key={s.key} className={`panel slot${it && !it.enabled ? ' off' : ''}`}>
              <header>
                <div><h2>{s.title}</h2><small className="muted">{s.hint}</small></div>
                {it && <button type="button" role="switch" aria-checked={it.enabled} disabled={ro || (!released && !it.enabled)} className={`switch${it.enabled ? ' on' : ''}`} onClick={() => setItem(i, { enabled: !it.enabled })}><span className="sr">Bật hoặc tắt {s.title}</span></button>}
              </header>
              {!released && <span className="pill warn">Sắp có · chưa kích hoạt được</span>}
              {it ? (
                <fieldset disabled={ro} className="form">
                  <label>Tên nút khách thấy<input value={it.label} maxLength={40} onChange={e => setItem(i, { label: e.target.value })} /></label>
                  <small className="muted action-id">mã nút <code>{it.id}</code> · hành động <code>{it.action_type}</code></small>
                  <ActionFields it={it} set={(k, v) => setAc(i, k, v)} />
                  {errAt(`menu[${i}]`) && <small className="danger-text">{errText(errAt(`menu[${i}]`)!.code)}</small>}
                </fieldset>
              ) : canManage ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy || cfg.menu.length >= MAX_MENU_ITEMS} onClick={() => addSlot(s)}>+ Thêm vào menu (bản nháp)</button>
                : <p className="muted">Chưa có trong menu.</p>}
            </section>
          );
        })}
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {canManage && (
        <div className="form-foot sticky-foot">
          <span className="muted">{draft ? `Bản nháp ${draft.version_no}` : 'Chưa có bản nháp'}</span>
          <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={d.reset}>Hoàn tác</button>
          <button type="button" className="btn btn-primary" disabled={!dirty || busy || draftErrors.length > 0} onClick={d.saveDraft}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button>
        </div>
      )}
    </>
  );
}
