import { FormEvent, useMemo, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { must, Product, useLoad } from '../data';
import { parseVnd, vnd } from '../format';
import { Empty, Modal, Notice, PageHead, Spinner } from '../ui';

type Edit = { mode: 'new' } | { mode: 'edit'; p: Product } | { mode: 'stock'; p: Product };

export function Products() {
  const { store, canManage } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [flash, setFlash] = useState('');
  const { data, error, loading, reload } = useLoad(async () =>
    must(await supabase.from('products').select('id, sku, name, price_vnd, stock_on_hand, is_active, updated_at')
      .eq('store_id', store.id).order('sku')) as Product[], [store.id]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter(p => !t || p.sku.toLowerCase().includes(t) || p.name.toLowerCase().includes(t));
  }, [data, q]);

  const done = async (text: string) => { setEdit(null); setFlash(text); await reload(); };

  return (
    <>
      <PageHead title="Sản phẩm & tồn kho" sub="Trợ lý AI chỉ tư vấn sản phẩm đang bán, theo đúng giá và tồn kho ở đây."
        actions={canManage && <button className="btn btn-primary" onClick={() => { setFlash(''); setEdit({ mode: 'new' }); }}>+ Thêm sản phẩm</button>} />
      {flash && <Notice kind="ok">{flash}</Notice>}
      {!canManage && <Notice>Bạn đang ở vai trò nhân viên nên chỉ xem được danh sách.</Notice>}
      <div className="toolbar"><input type="search" placeholder="Tìm theo SKU hoặc tên…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm sản phẩm" /></div>
      {loading ? <Spinner /> : error ? <Notice kind="err">{friendlyError(error)}</Notice> : list.length === 0 ? (
        <Empty title={data?.length ? 'Không có sản phẩm khớp tìm kiếm' : 'Chưa có sản phẩm'}>{!data?.length && canManage && 'Bấm “Thêm sản phẩm” để nhập mã SKU, giá và tồn kho.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th>Tên sản phẩm</th><th className="num">Giá</th><th className="num">Tồn kho</th><th>Trạng thái</th>{canManage && <th><span className="sr">Thao tác</span></th>}</tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td data-label="SKU"><code>{p.sku}</code></td>
                  <td data-label="Tên">{p.name}</td>
                  <td data-label="Giá" className="num">{vnd(p.price_vnd)}</td>
                  <td data-label="Tồn kho" className="num">{p.stock_on_hand <= 3 && p.is_active ? <span className="pill warn">{p.stock_on_hand}</span> : p.stock_on_hand}</td>
                  <td data-label="Trạng thái">{p.is_active ? <span className="pill ok">Đang bán</span> : <span className="pill">Ngừng bán</span>}</td>
                  {canManage && <td className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setEdit({ mode: 'edit', p }); }}>Sửa</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setFlash(''); setEdit({ mode: 'stock', p }); }}>Tồn kho</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit?.mode === 'stock' && <StockForm storeId={store.id} p={edit.p} onClose={() => setEdit(null)} onDone={done} />}
      {edit && edit.mode !== 'stock' && <ProductForm storeId={store.id} p={edit.mode === 'edit' ? edit.p : null} onClose={() => setEdit(null)} onDone={done} />}
    </>
  );
}

function ProductForm({ storeId, p, onClose, onDone }: { storeId: string; p: Product | null; onClose: () => void; onDone: (t: string) => void }) {
  const [sku, setSku] = useState(p?.sku ?? '');
  const [name, setName] = useState(p?.name ?? '');
  const [price, setPrice] = useState(p ? String(p.price_vnd) : '');
  const [stock, setStock] = useState('0');
  const [active, setActive] = useState(p?.is_active ?? true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    const priceN = parseVnd(price);
    const stockN = Number(stock);
    if (!sku.trim() || sku.trim() !== sku || sku.length > 80) return setErr('SKU không được để trống hay có khoảng trắng ở đầu/cuối.');
    if (!name.trim()) return setErr('Vui lòng nhập tên sản phẩm.');
    if (priceN === null) return setErr('Giá phải là số tiền VND, ví dụ 289000 hoặc 289.000. Không dùng “k”, “tr”.');
    if (!p && (!Number.isInteger(stockN) || stockN < 0)) return setErr('Tồn kho ban đầu phải là số nguyên từ 0.');
    setBusy(true);
    const { error } = await supabase.rpc('save_merchant_product_in_store', {
      p_store: storeId, p_sku: sku, p_name: name.trim(), p_price: priceN, p_active: active,
      p_initial_stock: p ? null : stockN, p_expected_updated_at: p ? p.updated_at : null,
    });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onDone(p ? `Đã lưu ${sku}.` : `Đã thêm ${sku}.`);
  }

  return (
    <Modal title={p ? `Sửa ${p.sku}` : 'Thêm sản phẩm'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Mã SKU<input value={sku} onChange={e => setSku(e.target.value)} disabled={!!p} maxLength={80} placeholder="VD: AO-SOMI-TRANG-M" /></label>
        <label>Tên sản phẩm<input value={name} onChange={e => setName(e.target.value)} maxLength={250} /></label>
        <div className="row2">
          <label>Giá bán (VND)<input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" placeholder="289000" /></label>
          {!p && <label>Tồn kho ban đầu<input value={stock} onChange={e => setStock(e.target.value)} inputMode="numeric" /></label>}
        </div>
        {price && parseVnd(price) !== null && <p className="muted">Khách sẽ thấy giá: <b>{vnd(parseVnd(price))}</b></p>}
        <label className="check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>Đang bán (bot được phép tư vấn sản phẩm này)</span></label>
        {err && <Notice kind="err">{err}</Notice>}
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
      </form>
    </Modal>
  );
}

function StockForm({ storeId, p, onClose, onDone }: { storeId: string; p: Product; onClose: () => void; onDone: (t: string) => void }) {
  const [val, setVal] = useState(String(p.stock_on_hand));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    const n = Number(val);
    if (!Number.isInteger(n) || n < 0) return setErr('Tồn kho phải là số nguyên từ 0.');
    setBusy(true);
    const { error } = await supabase.rpc('set_product_stock', { p_store: storeId, p_product: p.id, p_new_stock: n, p_expected_updated_at: p.updated_at });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onDone(`Đã cập nhật tồn kho ${p.sku}: ${p.stock_on_hand} → ${n}.`);
  }
  return (
    <Modal title={`Tồn kho ${p.sku}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">{p.name}. Hiện có <b>{p.stock_on_hand}</b>. Mỗi lần đổi đều được ghi nhật ký.</p>
        <label>Số lượng thực tế<input value={val} onChange={e => setVal(e.target.value)} inputMode="numeric" autoFocus /></label>
        {err && <Notice kind="err">{err}</Notice>}
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Cập nhật'}</button></div>
      </form>
    </Modal>
  );
}
