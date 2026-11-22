import { useStore } from '../store';
import { useLoad } from '../data';
import { supabase } from '../supabase';
import { useWorkspace } from '../workspace';
import { PageHead } from '../ui';

/** Where the Workspace sends notices. Shows only what is really configured; nothing is sent from here. */
export function Notifications() {
  const { store } = useStore();
  const ws = useWorkspace();
  const { data } = useLoad(async () => {
    const r = await supabase.from('store_bot_settings').select('notify_emails').eq('store_id', store.id).maybeSingle();
    return r.error ? null : ((r.data?.notify_emails as string[] | undefined) ?? []);
  }, [store.id]);
  const rows: [string, string, string, string][] = [
    ...(ws.industries.includes('shop') ? [['Email khi khách chốt đơn', data == null ? 'Chưa đọc được' : data.length ? data.join(', ') : 'Chưa có email', data?.length ? 'Đã lưu, sẽ gửi khi đơn hàng chạy trên App' : 'Tắt', '#/cai-dat-bot'] as [string, string, string, string]] : []),
    ['Khách cần nhân viên (bàn giao)', 'Telegram/email của nhân viên', 'Đội TIEN404 cấu hình cùng bạn', '#/hoi-thoai'],
    ['Báo cáo AI mỗi sáng', 'Chủ sở hữu, quản lý', 'Bản đề xuất, chưa gửi', '#/bao-cao'],
    ['Kênh mất kết nối', 'Chủ sở hữu', 'Dự kiến', '#/kenh-ban'],
  ];
  return (
    <>
      <PageHead title="Thông báo" sub="Những thông báo Workspace gửi cho bạn và đội ngũ, và trạng thái thật của từng loại." />
      <section className="panel">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Loại thông báo</th><th>Nơi nhận</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{rows.map(([a, b, c, href]) => <tr key={a}><td>{a}</td><td>{b}</td><td><span className="pill soft">{c}</span></td><td><a href={href}>Mở</a></td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
