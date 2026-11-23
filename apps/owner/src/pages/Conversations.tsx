// Conversations & handoff. Reads ONLY what exists: public.conversations (store-scoped, managers),
// customers in stage needs_human, and the handoff buttons of the PUBLISHED assistant configs.
import { useStore } from '../store';
import { isMissingFeature, useLoad } from '../data';
import { supabase } from '../supabase';
import { dateTime } from '../format';
import { HANDOFF_DEFAULT, TEAM_LABEL, Version } from '../assistant';
import { useWorkspace } from '../workspace';
import { Empty, Notice, PageHead, Spinner } from '../ui';

const CH: Record<string, string> = { messenger: 'Messenger', zalo: 'Zalo', zalo_bot: 'Zalo', web: 'Website', telegram: 'Telegram', line: 'LINE', api: 'API' };

export function Conversations() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const { data, error, loading } = useLoad(async () => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [c, n, v] = await Promise.all([
      supabase.from('conversations').select('channel, created_at').eq('store_id', store.id).gte('created_at', since).limit(1000),
      supabase.from('customers').select('id, display_name, created_at, note').eq('store_id', store.id).eq('stage', 'needs_human').order('created_at', { ascending: false }).limit(50),
      supabase.from('assistant_config_versions').select('assistant_id, version_no, state, config, config_sha256, source, created_at, published_at').eq('store_id', store.id).eq('state', 'published'),
    ]);
    return {
      convs: c.error ? null : c.data as { channel: string; created_at: string }[],
      needs: n.error ? (isMissingFeature(n.error) ? [] : null) : n.data as { id: string; display_name: string; created_at: string; note: string | null }[],
      live: (v.error ? [] : v.data) as (Version & { assistant_id: string })[],
    };
  }, [store.id]);

  if (!canManage) return <><PageHead title="Hội thoại & bàn giao" /><Notice>Chỉ chủ sở hữu và quản lý xem được hội thoại của khách.</Notice></>;
  if (loading) return <Spinner />;
  if (error || !data) return <><PageHead title="Hội thoại & bàn giao" /><Notice kind="err">Không tải được dữ liệu hội thoại.</Notice></>;
  const byCh = new Map<string, number>();
  for (const c of data.convs ?? []) byCh.set(c.channel, (byCh.get(c.channel) ?? 0) + 1);
  const routes = data.live.flatMap(v => v.config.menu.filter(m => m.enabled && m.action_type === 'HUMAN_HANDOFF').map(m => ({
    assistant: ws.assistants.find(a => a.id === v.assistant_id)?.name ?? 'Trợ lý', label: m.label, team: String(m.action_config.team),
    ack: String(m.action_config.ack_text ?? HANDOFF_DEFAULT[String(m.action_config.team)] ?? ''),
  })));

  return (
    <>
      <PageHead title="Hội thoại & bàn giao" sub={`Hội thoại 30 ngày gần nhất và những người cần nhân viên của ${store.name} xử lý.`} />
      <section className="panel">
        <h2>Hội thoại theo kênh (30 ngày)</h2>
        {data.convs === null ? <Notice kind="warn">Chưa đọc được nguồn hội thoại cho Workspace này.</Notice>
          : !data.convs.length ? <Empty title="Chưa có hội thoại nào được lưu về Workspace">Bot trên các kênh thử nghiệm hiện chưa ghi lịch sử hội thoại vào đây. Số liệu sẽ xuất hiện khi kênh được nối với kho hội thoại; TIEN404 không hiển thị số ước đoán.</Empty>
            : <div className="kpis">{[...byCh].map(([k, n]) => <div key={k} className="kpi"><span>{CH[k] ?? k}</span><b>{n}</b><small>hội thoại mới</small></div>)}</div>}
      </section>
      <section className="panel">
        <h2>Cần người xử lý</h2>
        {data.needs === null ? <Notice kind="warn">Không tải được danh sách.</Notice>
          : !data.needs.length ? <p className="muted">Không có {ws.people.toLowerCase()} nào đang chờ người thật.</p>
            : <ul className="plain needs-list">{data.needs.map(n => <li key={n.id}><b>{n.display_name}</b> <small className="muted">· {dateTime(n.created_at)}{n.note ? ` · ${n.note}` : ''}</small></li>)}</ul>}
        <a className="link-btn" href="#/khach-hang">Mở danh sách {ws.people.toLowerCase()}</a>
      </section>
      <section className="panel">
        <h2>Bàn giao đang chạy</h2>
        {!routes.length ? <p className="muted">Chưa có nút chuyển người thật nào đang chạy. Thêm hành động "Chuyển nhân viên" ở <a href="#/menu-tro-ly">Menu &amp; hành động</a> rồi kích hoạt.</p> : (
          <div className="table-wrap"><table className="table compact"><thead><tr><th>Trợ lý</th><th>Nút</th><th>Chuyển tới</th><th>Khách nhận được</th></tr></thead>
            <tbody>{routes.map((r, i) => <tr key={i}><td>{r.assistant}</td><td>{r.label}</td><td>{TEAM_LABEL[r.team] ?? r.team}</td><td>{r.ack}</td></tr>)}</tbody></table></div>
        )}
        <p className="fine muted">Nơi nhận thông báo bàn giao (Telegram/email của nhân viên) hiện do đội TIEN404 cấu hình cùng bạn.</p>
      </section>
    </>
  );
}
