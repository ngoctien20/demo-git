// Channel Integration Center. Connection status is READ from public.channel_connections (store-scoped
// RLS, service_role-only writes): the App never creates, binds or rebinds a Page/account. Capabilities
// come from config-core CHANNEL_CAPS (the renderer the bot bridge uses) plus documented limits.
import { useStore } from '../store';
import { isMissingFeature, useLoad } from '../data';
import { supabase } from '../supabase';
import { dateTime } from '../format';
import { SITE_HOME } from '../config';
import { CAPS, TEAM_LABEL, Version } from '../assistant';
import { useWorkspace } from '../workspace';
import { Notice, PageHead, Spinner } from '../ui';
import { ZaloConnect } from './ZaloConnect';

type Conn = { id: string; channel: string; display_name: string | null; environment: string; status: string; assistant_id: string | null; updated_at: string };

type Info = { key: string; name: string; label: 'Thử nghiệm có kiểm soát' | 'Thử nghiệm' | 'Bản nháp' | 'Thử nghiệm nội bộ' | 'Dự kiến';
  can: string[]; limits: string; perms: string; missing: string[]; capsKey?: string };
const CHANNELS: Info[] = [
  { key: 'messenger', capsKey: 'messenger', name: 'Facebook Messenger', label: 'Thử nghiệm có kiểm soát',
    can: ['Trả lời tin nhắn Fanpage', 'Nút trả lời nhanh và menu ☰', 'Mở đường dẫn HTTPS', 'Chuyển nhân viên'],
    limits: 'Trả lời trong 24 giờ kể từ tin cuối của khách. 13 nút trả lời nhanh (20 ký tự), menu ☰ 20 mục (30 ký tự).',
    perms: 'Quản trị Fanpage, kết nối ứng dụng Meta của TIEN404, quyền nhắn tin đã được Meta duyệt.',
    missing: ['Cập nhật menu ☰ thật từ App (cần duyệt riêng)', 'Lệnh gõ "menu" để mở lại nút trên điện thoại', 'Biểu cảm tự động (mặc định tắt)'] },
  { key: 'zalo_bot', capsKey: 'zalo_bot', name: 'Zalo Bot', label: 'Thử nghiệm',
    can: ['Nhận và trả lời tin nhắn', 'Menu thành danh sách đánh số'],
    limits: 'Chủ yếu hiển thị chữ. Theo chính sách Zalo Bot.', perms: 'Tạo Zalo Bot và giao quyền cho TIEN404.',
    missing: ['Nút bấm tương tác', 'Zalo Official Account (chưa kiểm thử)'] },
  { key: 'web', capsKey: 'web', name: 'Website Chat', label: 'Bản nháp',
    can: ['Khung chat nhúng trên website', 'Tối đa 12 nút trong khung chat', 'Giao diện sáng/tối'],
    limits: 'Chưa phát mã nhúng: cần chống spam, giới hạn tần suất và kiểm soát chi phí AI trước khi mở.',
    perms: 'Khai báo tên miền được phép nhúng.', missing: ['Mã nhúng tự phục vụ', 'Chống spam / giới hạn tần suất'] },
  { key: 'telegram', capsKey: 'telegram', name: 'Telegram', label: 'Thử nghiệm nội bộ',
    can: ['Tin nhắn chữ và tin nhắn thoại', 'Menu thành danh sách'], limits: 'Nút bấm trong tin chưa hỗ trợ.',
    perms: 'Bot tạo qua BotFather, token giao cho TIEN404.', missing: ['Kết nối tự phục vụ cho từng Workspace'] },
  { key: 'instagram', name: 'Instagram', label: 'Dự kiến', can: [], limits: 'Chưa trả lời khách thật.',
    perms: 'Tài khoản chuyên nghiệp liên kết Fanpage, quyền nhắn tin Instagram và xét duyệt ứng dụng Meta.', missing: ['Toàn bộ kết nối'] },
];
const ENV: Record<string, string> = { demo: 'Môi trường demo', staging: 'Môi trường thử nghiệm', production: 'Đang phục vụ khách thật' };
const STATUS: Record<string, [string, string]> = { active: ['ok', 'Đã gắn'], pending: ['warn', 'Đang chờ kiểm tra'], disabled: ['', 'Đã tắt'] };

export function Channels() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const { data, error, loading } = useLoad(async () => {
    const c = await supabase.from('channel_connections').select('id, channel, display_name, environment, status, assistant_id, updated_at').eq('store_id', store.id);
    if (c.error) { if (isMissingFeature(c.error)) return { conns: null, live: [] as (Version & { assistant_id: string })[] }; throw c.error; }
    const v = await supabase.from('assistant_config_versions').select('assistant_id, version_no, state, config, config_sha256, source, created_at, published_at').eq('store_id', store.id).eq('state', 'published');
    return { conns: c.data as Conn[], live: (v.error ? [] : v.data) as (Version & { assistant_id: string })[] };
  }, [store.id]);

  if (loading) return <Spinner />;
  const conns = data?.conns ?? [];
  const nameOf = (id: string | null) => ws.assistants.find(a => a.id === id)?.name ?? 'chưa chọn trợ lý';
  const handoff = (assistantId: string | null) => {
    const cfg = data?.live.find(v => v.assistant_id === assistantId)?.config;
    const teams = (cfg?.menu ?? []).filter(m => m.enabled && m.action_type === 'HUMAN_HANDOFF').map(m => TEAM_LABEL[String(m.action_config.team)] ?? String(m.action_config.team));
    return teams.length ? teams.join(', ') : 'chưa có nút chuyển người thật đang chạy';
  };

  return (
    <>
      <PageHead title="Kênh kết nối" sub={`Nơi khách nhắn với trợ lý của ${store.name}. Mỗi kênh có khả năng khác nhau.`} />
      <Notice>Trong giai đoạn thử nghiệm, đội TIEN404 gắn từng Fanpage/tài khoản vào đúng Workspace sau khi kiểm tra quyền sở hữu. App chỉ hiển thị trạng thái, không tự gắn hay chuyển kênh. Riêng Zalo Bot: chủ shop tự nối bằng mã bot ngay bên dưới.</Notice>
      {error && <Notice kind="err">Không tải được trạng thái kết nối. Các kênh dưới đây hiển thị như chưa kết nối.</Notice>}
      {data?.conns === null && <Notice kind="warn">Trạng thái kết nối chưa được bật trên máy chủ.</Notice>}
      <div className="channel-grid">
        {CHANNELS.map(c => {
          const mine = conns.filter(x => x.channel === c.key);
          const caps = c.capsKey ? CAPS[c.capsKey] : undefined;
          return (
            <section key={c.key} className="panel channel">
              <header className="channel-head"><h2>{c.name}</h2><span className={`pill ${c.label === 'Dự kiến' ? '' : 'soft'}`}>{c.label}</span></header>
              {c.key === 'zalo_bot' ? <ZaloConnect key={store.id} storeId={store.id} canManage={canManage} /> : mine.length ? (
                <ul className="plain conn-list">
                  {mine.map(m => (
                    <li key={m.id}>
                      <span className={`pill ${STATUS[m.status]?.[0] ?? ''}`}>{STATUS[m.status]?.[1] ?? m.status}</span> <b>{m.display_name ?? 'Tài khoản đã gắn'}</b>
                      <small className="muted"> · {ENV[m.environment] ?? m.environment} · trợ lý: {nameOf(m.assistant_id)} · cập nhật {dateTime(m.updated_at)}</small>
                      <small className="muted">Bàn giao tới: {handoff(m.assistant_id)}</small>
                      {m.assistant_id && <a className="link-btn" href={`#/menu-tro-ly?a=${m.assistant_id}&kenh=${c.key}`}>Xem trước trên kênh này</a>}
                    </li>
                  ))}
                </ul>
              ) : <p><span className="pill">Chưa kết nối</span></p>}
              {c.can.length > 0 && <><h3>Làm được</h3><ul className="ticks">{c.can.map(x => <li key={x}>{x}</li>)}</ul></>}
              <dl className="facts">
                <dt>Giới hạn</dt><dd>{c.limits}</dd>
                <dt>Cần cấp quyền</dt><dd>{c.perms}</dd>
                <dt>Chưa có</dt><dd>{c.missing.join('; ')}</dd>
                {caps && <><dt>Hiển thị menu</dt><dd>{caps.mode === 'buttons' ? 'Nút bấm' : 'Danh sách chữ, khách gõ số'}{caps.verified ? '' : ' · chưa kiểm thử'}</dd></>}
              </dl>
              {!mine.length && c.label !== 'Dự kiến' && c.key !== 'zalo_bot' && <a className="btn btn-ghost btn-sm" href={`${SITE_HOME}contact.html?goi=cua-hang`} target="_blank" rel="noopener">Nhờ TIEN404 kết nối</a>}
            </section>
          );
        })}
      </div>
      <section className="panel">
        <h2>Danh tính khách giữa các kênh</h2>
        <p className="muted">TIEN404 không tự gộp khách Messenger, Zalo và website thành một người chỉ vì họ đưa cùng mã đơn. Tra cứu đơn từ kênh khác phải qua bước xác minh người hỏi.</p>
      </section>
    </>
  );
}
