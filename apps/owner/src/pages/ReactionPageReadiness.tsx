import { useState } from 'react';
import { useStore } from '../store';
import { must, useLoad } from '../data';
import { supabase, friendlyError } from '../supabase';
import { Notice, Spinner } from '../ui';

type MessengerConnection = {
  id: string;
  display_name: string | null;
  status: string;
  environment: string;
};

/**
 * V21.5: READ-ONLY connection discovery. RLS is a second layer; all queries are scoped
 * to the currently selected store+tenant, and non-owners never issue this query.
 * A channel_connections record is NOT Meta installation/ownership/industry proof.
 * Never treat status=active as authorization to save or dispatch reactions.
 */
export function ReactionPageReadiness() {
  const { store } = useStore();
  const [picked, setPicked] = useState('');
  const list = useLoad(async (): Promise<MessengerConnection[]> => {
    if (store.role !== 'owner') return [];
    const query = await supabase
      .from('channel_connections')
      .select('id, display_name, status, environment')
      .eq('tenant_id', store.tenant_id)
      .eq('store_id', store.id)
      .eq('channel', 'messenger')
      .order('created_at', { ascending: false });
    return (must(query) ?? []) as MessengerConnection[];
  }, [store.tenant_id, store.id, store.role]);

  const item = list.data?.find(p => p.id === picked) ?? list.data?.[0];
  return (
    <section className="panel form" aria-label="Kết nối Messenger chỉ xem">
      <h2>Kết nối Messenger của cửa hàng</h2>
      <p className="muted">Danh sách này đọc từ Channel Registry có phân quyền. Một kết nối được ghi nhận không có nghĩa đã xác minh quyền quản trị Fanpage hoặc đồng ý gửi reaction.</p>
      {store.role !== 'owner' ? (
        <Notice kind="warn">Chỉ chủ cửa hàng mới được xem danh sách kết nối để chuẩn bị cấu hình reaction. Nhân viên và quản lý không thể lưu bản nháp.</Notice>
      ) : list.loading ? <Spinner /> : list.error ? (
        <Notice kind="warn">Không tải được danh sách kết nối: {friendlyError(list.error)}. Chưa có quyền kích hoạt reaction.</Notice>
      ) : !list.data?.length ? (
        <Notice>Chưa có kết nối Messenger trong cửa hàng này. Không thể lưu hoặc bật reaction.</Notice>
      ) : (
        <>
          <label htmlFor="reaction-page-picker">Chọn kết nối Messenger (chỉ xem)</label>
          <select id="reaction-page-picker" value={item?.id ?? ''}
            onChange={e => setPicked(e.target.value)}>
            {list.data.map(p => (
              <option key={p.id} value={p.id}>{p.display_name?.trim() || 'Fanpage chưa đặt tên'}</option>
            ))}
          </select>
          <p className="muted">Trạng thái Registry: <b>{item?.status === 'active' ? 'Đang hoạt động trong Registry' : 'Chưa hoạt động'}</b> · Môi trường: <b>{item?.environment === 'demo' ? 'DEMO' : item?.environment === 'staging' ? 'Staging' : 'Khác'}</b>.</p>
          <Notice kind="warn">Chưa có bằng chứng Meta Page Installation, quyền chủ trang, ngành đã xác minh hoặc chính sách được phê duyệt. Chỉ được xem kết nối; không được lưu cấu hình, không được gửi reaction.</Notice>
        </>
      )}
    </section>
  );
}
