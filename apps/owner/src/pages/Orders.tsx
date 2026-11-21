import { useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { must, Order, ORDER_SOURCE, ORDER_STATUS, useLoad } from '../data';
import { dateTime, vnd } from '../format';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';

type Item = { quantity: number; unit_price_vnd: number; line_total_vnd: number | null; products: { sku: string; name: string } | null };

export function Orders() {
  const { store, canManage } = useStore();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Order | null>(null);
  const { data, error, loading } = useLoad(async () => {
    let q = supabase.from('orders').select('id, status, total_vnd, order_source, created_at, customer_id').eq('store_id', store.id)
      .order('created_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    const orders = must(await q) as Order[];
    const ids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const c = await supabase.from('customers').select('id, display_name').in('id', ids);
      if (!c.error) c.data.forEach(r => names.set(r.id, r.display_name));
    }
    return { orders, names };
  }, [store.id, status]);

  if (!canManage) return <><PageHead title="Đơn hàng" /><Notice>Chỉ chủ shop và quản lý xem được đơn hàng.</Notice></>;
  return (
    <>
      <PageHead title="Đơn hàng" sub="Đơn do trợ lý AI ghi nhận trên các kênh hoặc nhập tay. Tối đa 200 đơn gần nhất." />
      <Notice>Đơn từ bot Messenger đang được chuyển dần vào App. Trong lúc chuyển, đơn của shop thử nghiệm có thể vẫn nằm ở bảng tính cũ.</Notice>
      <div className="tabs" role="tablist" aria-label="Lọc theo trạng thái">
        {[['', 'Tất cả'], ...Object.entries(ORDER_STATUS)].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      {loading ? <Spinner /> : error || !data ? <Notice kind="err">{friendlyError(error)}</Notice> : data.orders.length === 0 ? (
        <Empty title="Chưa có đơn hàng">Khi trợ lý AI ghi nhận đơn, đơn sẽ hiện ở đây để bạn duyệt.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Thời gian</th><th>Khách</th><th>Kênh</th><th className="num">Tổng tiền</th><th>Trạng thái</th><th><span className="sr">Chi tiết</span></th></tr></thead>
            <tbody>
              {data.orders.map(o => (
                <tr key={o.id}>
                  <td data-label="Thời gian">{dateTime(o.created_at)}</td>
                  <td data-label="Khách">{(o.customer_id && data.names.get(o.customer_id)) || '—'}</td>
                  <td data-label="Kênh">{ORDER_SOURCE[o.order_source] ?? o.order_source}</td>
                  <td data-label="Tổng tiền" className="num">{vnd(o.total_vnd)}</td>
                  <td data-label="Trạng thái"><span className={`pill ${o.status === 'pending' ? 'warn' : o.status === 'paid' || o.status === 'confirmed' ? 'ok' : ''}`}>{ORDER_STATUS[o.status] ?? o.status}</span></td>
                  <td className="row-actions"><button className="btn btn-sm btn-ghost" onClick={() => setOpen(o)}>Xem</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <OrderDetail o={open} name={(open.customer_id && data?.names.get(open.customer_id)) || '—'} onClose={() => setOpen(null)} />}
    </>
  );
}

function OrderDetail({ o, name, onClose }: { o: Order; name: string; onClose: () => void }) {
  const { data, error, loading } = useLoad(async () =>
    must(await supabase.from('order_items').select('quantity, unit_price_vnd, line_total_vnd, products(sku, name)').eq('order_id', o.id)) as unknown as Item[], [o.id]);
  return (
    <Modal title={`Đơn ${o.id.slice(0, 8).toUpperCase()}`} onClose={onClose}>
      <dl className="facts">
        <dt>Khách</dt><dd>{name}</dd><dt>Thời gian</dt><dd>{dateTime(o.created_at)}</dd>
        <dt>Kênh</dt><dd>{ORDER_SOURCE[o.order_source] ?? o.order_source}</dd><dt>Trạng thái</dt><dd>{ORDER_STATUS[o.status] ?? o.status}</dd>
      </dl>
      {loading ? <Spinner /> : error ? <Notice kind="err">{friendlyError(error)}</Notice> : !data?.length ? <p className="muted">Đơn này chưa có dòng sản phẩm.</p> : (
        <table className="table compact"><thead><tr><th>Sản phẩm</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Thành tiền</th></tr></thead>
          <tbody>{data.map((it, i) => (
            <tr key={i}><td>{it.products ? `${it.products.sku} · ${it.products.name}` : '—'}</td><td className="num">{it.quantity}</td><td className="num">{vnd(it.unit_price_vnd)}</td><td className="num">{vnd(it.line_total_vnd ?? it.quantity * it.unit_price_vnd)}</td></tr>
          ))}</tbody></table>
      )}
      <p className="total">Tổng: <b>{vnd(o.total_vnd)}</b></p>
    </Modal>
  );
}
