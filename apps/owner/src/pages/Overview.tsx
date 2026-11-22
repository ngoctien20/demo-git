import { supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature, must, useLoad } from '../data';
import { vnd } from '../format';
import { INDUSTRY_META, useWorkspace } from '../workspace';
import { Notice, PageHead, Spinner } from '../ui';

export function Overview() {
  const { store, canManage } = useStore();
  const ws = useWorkspace();
  const shop = ws.industries.includes('shop');
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error, loading } = useLoad(async () => {
    const [p, o, settings, faqs, needs, vers, conns] = await Promise.all([
      shop ? supabase.from('products').select('stock_on_hand, is_active').eq('store_id', store.id) : Promise.resolve({ data: [], error: null }),
      shop && canManage ? supabase.from('orders').select('status, total_vnd').eq('store_id', store.id).gte('created_at', since) : Promise.resolve({ data: [], error: null }),
      supabase.from('store_bot_settings').select('bot_enabled, shop_info').eq('store_id', store.id).maybeSingle(),
      supabase.from('store_faqs').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('stage', 'needs_human'),
      supabase.from('assistant_config_versions').select('assistant_id, state').eq('store_id', store.id).in('state', ['draft', 'published']),
      supabase.from('channel_connections').select('status').eq('store_id', store.id),
    ]);
    const products = must(p) as { stock_on_hand: number; is_active: boolean }[];
    const orders = must(o) as { status: string; total_vnd: number }[];
    const v23 = !settings.error || !isMissingFeature(settings.error);
    const v = (vers.error ? [] : vers.data) as { assistant_id: string; state: string }[];
    return {
      active: products.filter(x => x.is_active).length,
      low: products.filter(x => x.is_active && x.stock_on_hand <= 3).length,
      total: products.length,
      orders: orders.length,
      pending: orders.filter(x => x.status === 'pending').length,
      revenue: orders.filter(x => x.status === 'confirmed' || x.status === 'paid').reduce((a, x) => a + Number(x.total_vnd), 0),
      v23,
      botOn: settings.data?.bot_enabled ?? null,
      hasInfo: !!settings.data?.shop_info,
      faqs: faqs.count ?? 0,
      needs: needs.error ? null : needs.count ?? 0,
      live: new Set(v.filter(x => x.state === 'published').map(x => x.assistant_id)).size,
      drafts: v.filter(x => x.state === 'draft').length,
      channels: conns.error ? null : (conns.data as { status: string }[]).filter(x => x.status === 'active').length,
    };
  }, [store.id, shop, canManage]);

  if (loading) return <Spinner />;
  if (error || !data) return <Notice kind="err">Không tải được số liệu của Workspace.</Notice>;
  const meta = INDUSTRY_META[ws.primary];
  const steps: [boolean, string, string][] = [
    [ws.assistants.length > 0, 'Tạo trợ lý từ mẫu ngành', '#/tro-ly'],
    [data.hasInfo || data.faqs > 0, 'Nhập kho kiến thức: giới thiệu, câu hỏi thường gặp', '#/tri-thuc'],
    ...(shop ? [[data.total > 0, 'Thêm sản phẩm, giá và tồn kho', '#/san-pham'] as [boolean, string, string]] : []),
    ...ws.industries.filter(i => i !== 'shop').map(i => [false, `Điền ${INDUSTRY_META[i].modules[0].label.toLowerCase()}`, `#${INDUSTRY_META[i].modules[0].path}`] as [boolean, string, string]),
    [data.live > 0, 'Xem trước menu và kích hoạt trợ lý', '#/menu-tro-ly'],
    [(data.channels ?? 0) > 0, 'Kết nối Messenger, Zalo hoặc website', '#/kenh-ban'],
  ];
  return (
    <>
      <PageHead title="Tổng quan" sub={`${store.name} · ${ws.industries.map(i => INDUSTRY_META[i].label).join(' · ')}`} />
      {!data.v23 && <Notice kind="warn">Một số chức năng (cài đặt, hỏi đáp, giai đoạn khách) chưa được bật trên máy chủ.</Notice>}
      <div className="kpis">
        <div className="kpi"><span>Trợ lý đang chạy</span><b>{data.live}</b><small>{ws.assistants.length} trợ lý · {data.drafts} bản nháp chưa kích hoạt</small></div>
        <div className="kpi"><span>Kênh đã gắn</span><b>{data.channels ?? '—'}</b><small>Xem trạng thái ở Kênh kết nối</small></div>
        <div className="kpi"><span>Cần người xử lý</span><b>{data.needs ?? '—'}</b><small>{meta.people} đang chờ nhân viên</small></div>
        {shop
          ? <div className="kpi"><span>Đơn hàng 30 ngày</span><b>{canManage ? data.orders : '—'}</b><small>{canManage ? `${data.pending} chờ duyệt · ${vnd(data.revenue)} đã xác nhận` : 'Chỉ chủ sở hữu, quản lý xem được'}</small></div>
          : <div className="kpi"><span>Câu hỏi trong kho kiến thức</span><b>{data.faqs}</b><small>Trợ lý ưu tiên dùng đúng nội dung này</small></div>}
      </div>
      {shop && <div className="kpis two">
        <div className="kpi"><span>Sản phẩm đang bán</span><b>{data.active}</b><small>{data.low > 0 ? `${data.low} sắp hết hàng (≤ 3)` : 'Tồn kho ổn'}</small></div>
        <div className="kpi"><span>Câu hỏi trong kho kiến thức</span><b>{data.faqs}</b><small>Trợ lý ưu tiên dùng đúng nội dung này</small></div>
      </div>}
      <div className="grid2">
        <section className="panel">
          <h2>Bắt đầu</h2>
          <ol className="checklist">
            {steps.map(([done, label, href]) => <li key={label} className={done ? 'done' : ''}><a href={href}>{label}</a></li>)}
          </ol>
        </section>
        <section className="panel">
          <h2>Trợ lý AI</h2>
          <p className="status-line">Trả lời tự động: {data.botOn === null ? <span className="pill">Chưa cài đặt</span> : data.botOn ? <span className="pill ok">Đang bật</span> : <span className="pill warn">Đang tắt</span>}</p>
          <p className="muted">Trong giai đoạn thử nghiệm, trợ lý trên các kênh được đội TIEN404 kết nối và đọc dần cấu hình bạn kích hoạt ở đây. Bản nháp không ảnh hưởng tới khách.</p>
          <div className="row-actions"><a className="btn btn-ghost" href="#/tro-ly">Quản lý trợ lý</a><a className="btn btn-ghost" href="#/cai-dat-bot">Cài đặt</a></div>
        </section>
      </div>
    </>
  );
}
