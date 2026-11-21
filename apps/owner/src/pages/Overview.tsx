import { supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature, must, useLoad } from '../data';
import { vnd } from '../format';
import { Notice, PageHead, Spinner } from '../ui';

export function Overview() {
  const { store } = useStore();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error, loading } = useLoad(async () => {
    const [p, o, settings, faqs, needs] = await Promise.all([
      supabase.from('products').select('stock_on_hand, is_active').eq('store_id', store.id),
      supabase.from('orders').select('status, total_vnd').eq('store_id', store.id).gte('created_at', since),
      supabase.from('store_bot_settings').select('bot_enabled, shop_info').eq('store_id', store.id).maybeSingle(),
      supabase.from('store_faqs').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('stage', 'needs_human'),
    ]);
    const products = must(p); const orders = must(o);
    const v23 = !settings.error || !isMissingFeature(settings.error);
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
    };
  }, [store.id]);

  if (loading) return <Spinner />;
  if (error || !data) return <Notice kind="err">Không tải được số liệu cửa hàng.</Notice>;
  const steps: [boolean, string, string][] = [
    [data.total > 0, 'Thêm sản phẩm, giá và tồn kho', '#/san-pham'],
    [data.hasInfo, 'Điền thông tin shop cho bot', '#/cai-dat-bot'],
    [data.faqs > 0, 'Thêm câu hỏi thường gặp', '#/tri-thuc'],
    [false, 'Kết nối Messenger, Zalo hoặc website', '#/kenh-ban'],
  ];
  return (
    <>
      <PageHead title="Tổng quan" sub={`${store.name} · 30 ngày gần nhất`} />
      {!data.v23 && <Notice kind="warn">Một số chức năng (cài đặt bot, hỏi đáp, giai đoạn khách) chưa được bật trên máy chủ.</Notice>}
      <div className="kpis">
        <div className="kpi"><span>Đơn hàng</span><b>{data.orders}</b><small>{data.pending} chờ duyệt</small></div>
        <div className="kpi"><span>Doanh thu đã xác nhận</span><b>{vnd(data.revenue)}</b><small>Đơn đã xác nhận hoặc đã thanh toán</small></div>
        <div className="kpi"><span>Sản phẩm đang bán</span><b>{data.active}</b><small>{data.low > 0 ? `${data.low} sắp hết hàng (≤ 3)` : 'Tồn kho ổn'}</small></div>
        <div className="kpi"><span>Khách cần người xử lý</span><b>{data.needs ?? '—'}</b><small>Khiếu nại, đòi gặp người thật</small></div>
      </div>
      <div className="grid2">
        <section className="panel">
          <h2>Bắt đầu</h2>
          <ol className="checklist">
            {steps.map(([done, label, href]) => <li key={label} className={done ? 'done' : ''}><a href={href}>{label}</a></li>)}
          </ol>
        </section>
        <section className="panel">
          <h2>Trợ lý AI</h2>
          <p className="status-line">Trạng thái: {data.botOn === null ? <span className="pill">Chưa cài đặt</span> : data.botOn ? <span className="pill ok">Đang bật</span> : <span className="pill warn">Đang tắt</span>}</p>
          <p className="muted">Trong giai đoạn thử nghiệm, bot trên các kênh được đội TIEN404 kết nối và đọc dần các cài đặt bạn lưu ở đây.</p>
          <a className="btn btn-ghost" href="#/cai-dat-bot">Mở cài đặt bot</a>
        </section>
      </div>
    </>
  );
}
