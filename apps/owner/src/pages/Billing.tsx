import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useLoad } from '../data';
import { friendlyError } from '../supabase';
import { dateTime, vnd } from '../format';
import { Modal, Notice, Spinner } from '../ui';
import { billing, BillingState, Cycle, DEMO_BANK, demoQrSvg, Invoice, PlanKey, planName, PLANS, price, takePendingPlan } from '../billing';

const STATUS: Record<string, [string, string]> = {
  trial: ['Đang dùng thử', 'soft'], active: ['Đang hoạt động', 'ok'], canceled: ['Đã huỷ gia hạn', 'warn'],
  pending: ['Chờ thanh toán', 'warn'], paid: ['Đã thanh toán (DEMO)', 'ok'], void: ['Đã huỷ', 'soft'],
};
const cycleText = (c: Cycle) => (c === 'year' ? '12 tháng' : '1 tháng');
const dateOnly = (s: string | null) => (s ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s)) : '—');

export function DemoBanner({ source }: { source?: BillingState['source'] }) {
  return (
    <div className="demo-banner" role="note">
      <b>BẢN DEMO</b>
      <span>Không thu tiền thật, không cần chuyển khoản và không lưu thông tin ngân hàng. Giá là giá minh hoạ, TIEN404 sẽ chốt giá chính thức sau.
        {source === 'browser' && ' Dữ liệu demo đang lưu trong trình duyệt này.'}</span>
    </div>
  );
}

export function Billing() {
  const { store } = useStore();
  const isOwner = store.role === 'owner';
  const st = useLoad(() => billing.state(store.id), [store.id]);
  const [cycle, setCycle] = useState<Cycle>('month');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pay, setPay] = useState<Invoice | null>(null);
  const [view, setView] = useState<Invoice | null>(null);
  const [paidNow, setPaidNow] = useState<Invoice | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [suggest, setSuggest] = useState<PlanKey | null>(null);

  useEffect(() => { setSuggest(takePendingPlan()); }, []);

  const data = st.data;
  const sub = data?.subscription;
  const pending = useMemo(() => data?.invoices.find(i => i.status === 'pending') ?? null, [data]);

  async function act(fn: () => Promise<BillingState>, after?: (s: BillingState) => void) {
    setBusy(true); setErr('');
    try { const s = await fn(); st.setData(s); after?.(s); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  }
  const choose = (p: PlanKey) => act(() => billing.checkout(store.id, p, cycle), s => { setPay(s.invoices[0]); setSuggest(null); });

  if (st.loading && !data) return <Spinner label="Đang tải gói dịch vụ…" />;
  if (st.error || !data || !sub) return <Notice kind="err">{friendlyError(st.error)} <button className="link-btn" onClick={st.reload}>Thử lại</button></Notice>;

  return (
    <div className="billing">
      <DemoBanner source={data.source} />
      {err && <Notice kind="err">{err}</Notice>}
      {!isOwner && <Notice>Chỉ <b>chủ sở hữu</b> workspace mới đổi gói và thanh toán. Bạn đang xem ở chế độ chỉ đọc.</Notice>}

      <section className="panel plan-current">
        <div>
          <p className="eyebrow">Gói hiện tại</p>
          <h2>{planName(sub.plan)} <span className={`pill ${STATUS[sub.status][1]}`}>{STATUS[sub.status][0]}</span></h2>
          {sub.status === 'trial' && <p className="muted">Bạn đang dùng thử miễn phí. Chọn một gói bên dưới để xem thử cách thanh toán.</p>}
          {sub.status === 'active' && <p className="muted">Chu kỳ {cycleText(sub.cycle)} · {vnd(price(sub.plan as PlanKey, sub.cycle))} · Gia hạn ngày <b>{dateOnly(sub.renews_at)}</b></p>}
          {sub.status === 'canceled' && <p className="muted">Vẫn dùng được tới <b>{dateOnly(sub.renews_at)}</b>, sau đó quay về dùng thử. Chọn lại gói bất cứ lúc nào.</p>}
        </div>
        {isOwner && sub.status === 'active' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirmCancel(true)}>Huỷ gia hạn</button>}
      </section>

      {pending && (
        <div className="pending-bar">
          <span>Hoá đơn <b>{pending.number}</b> ({PLANS[pending.plan].name}, {vnd(pending.amount_vnd)}) đang chờ thanh toán.</span>
          {isOwner && <button className="btn btn-primary btn-sm" onClick={() => setPay(pending)}>Thanh toán (DEMO)</button>}
        </div>
      )}

      <div className="plan-head">
        <h2>Chọn gói</h2>
        <div className="seg" role="radiogroup" aria-label="Chu kỳ thanh toán">
          <button type="button" role="radio" aria-checked={cycle === 'month'} onClick={() => setCycle('month')}>Theo tháng</button>
          <button type="button" role="radio" aria-checked={cycle === 'year'} onClick={() => setCycle('year')}>Theo năm <em>-2 tháng</em></button>
        </div>
      </div>
      <div className="plan-grid">
        {(Object.keys(PLANS) as PlanKey[]).map(k => {
          const p = PLANS[k];
          const current = sub.status !== 'trial' && sub.plan === k && sub.cycle === cycle && sub.status === 'active';
          return (
            <article key={k} className={`plan-card${p.best ? ' best' : ''}${suggest === k ? ' suggested' : ''}`}>
              {p.best && <span className="ribbon">Phổ biến</span>}
              {suggest === k && !p.best && <span className="ribbon alt">Bạn đã chọn</span>}
              <h3>{p.name}</h3>
              <p className="muted small">{p.tagline}</p>
              <p className="price"><b>{vnd(price(k, cycle))}</b><span>/{cycle === 'year' ? 'năm' : 'tháng'}</span></p>
              {cycle === 'year' && <p className="save">Tương đương {vnd(Math.round(price(k, 'year') / 12))}/tháng</p>}
              <p className="who">{p.who}</p>
              <ul className="ticks small">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
              <button className={`btn btn-block ${p.best || suggest === k ? 'btn-primary' : 'btn-ghost'}`} disabled={!isOwner || busy || current} onClick={() => choose(k)}>
                {current ? 'Đang dùng' : sub.status === 'active' && sub.plan === k ? 'Đổi chu kỳ' : `Chọn ${p.name}`}
              </button>
            </article>
          );
        })}
      </div>
      <p className="fine">Giá chưa gồm VAT. Đây là giá minh hoạ cho bản DEMO.</p>

      <section className="panel">
        <h2>Lịch sử hoá đơn</h2>
        {data.invoices.length === 0 ? <p className="muted">Chưa có hoá đơn nào.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Số hoá đơn</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead>
            <tbody>{data.invoices.map(i => (
              <tr key={i.id}>
                <td><code>{i.number}</code></td><td>{PLANS[i.plan].name} · {cycleText(i.cycle)}</td><td>{vnd(i.amount_vnd)}</td>
                <td><span className={`pill ${STATUS[i.status][1]}`}>{STATUS[i.status][0]}</span></td><td>{dateTime(i.created_at)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setView(i)}>Xem</button></td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data.source === 'browser' && isOwner && data.invoices.length > 0 && (
          <p className="fine"><button className="link-btn" onClick={() => { billing.resetBrowser(store.id); st.reload(); }}>Xoá dữ liệu demo trong trình duyệt này</button></p>
        )}
      </section>

      {pay && (
        <PayModal inv={pay} busy={busy} onClose={() => setPay(null)}
          onPaid={() => act(() => billing.confirm(store.id, pay.id), s => { setPay(null); setPaidNow(s.invoices.find(i => i.id === pay.id) ?? null); })}
          onVoid={() => act(() => billing.void(store.id, pay.id), () => setPay(null))} />
      )}
      {paidNow && (
        <Modal title="Đã kích hoạt gói (DEMO)" onClose={() => setPaidNow(null)}>
          <div className="paid-ok"><span aria-hidden="true">✓</span><h3>Gói {PLANS[paidNow.plan].name} đã được kích hoạt</h3>
            <p className="muted">Đây là mô phỏng. Không có tiền nào được chuyển.</p></div>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => { setView(paidNow); setPaidNow(null); }}>Xem hoá đơn mẫu</button><button className="btn btn-primary" onClick={() => setPaidNow(null)}>Xong</button></div>
        </Modal>
      )}
      {view && <InvoiceModal inv={view} shop={store.tenant_name || store.name} onClose={() => setView(null)} />}
      {confirmCancel && (
        <Modal title="Huỷ gia hạn gói?" onClose={() => setConfirmCancel(false)}>
          <p>Gói {planName(sub.plan)} vẫn dùng được tới <b>{dateOnly(sub.renews_at)}</b>. Sau ngày đó workspace quay về dùng thử. (DEMO)</p>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>Giữ gói</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => act(() => billing.cancel(store.id), () => setConfirmCancel(false))}>Huỷ gia hạn</button></div>
        </Modal>
      )}
    </div>
  );
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}>{done ? 'Đã chép' : 'Chép'}</button>;
}

function PayModal({ inv, busy, onClose, onPaid, onVoid }: { inv: Invoice; busy: boolean; onClose: () => void; onPaid: () => void; onVoid: () => void }) {
  const svg = useMemo(() => demoQrSvg(inv), [inv]);
  return (
    <Modal title="Thanh toán gói (DEMO)" onClose={onClose}>
      <DemoBanner />
      <div className="pay-grid">
        <div className="qr-box">
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <span className="qr-stamp" aria-hidden="true">DEMO</span>
          <p className="fine">Mã QR mẫu, không phải mã chuyển khoản. Quét bằng app ngân hàng sẽ không ra lệnh chuyển tiền.</p>
        </div>
        <dl className="pay-facts">
          <div><dt>Gói</dt><dd>{PLANS[inv.plan].name} · {cycleText(inv.cycle)}</dd></div>
          <div><dt>Số tiền</dt><dd className="amount">{vnd(inv.amount_vnd)}</dd></div>
          <div><dt>Ngân hàng</dt><dd>{DEMO_BANK.bank}</dd></div>
          <div><dt>Số tài khoản</dt><dd><code>{DEMO_BANK.account}</code></dd></div>
          <div><dt>Chủ tài khoản</dt><dd>{DEMO_BANK.holder}</dd></div>
          <div><dt>Nội dung</dt><dd><code>{inv.transfer_note}</code> <Copy text={inv.transfer_note} /></dd></div>
          <div><dt>Hoá đơn</dt><dd><code>{inv.number}</code></dd></div>
        </dl>
      </div>
      <ol className="pay-steps"><li>Khi chạy thật: khách quét mã VietQR bằng app ngân hàng, giữ nguyên nội dung chuyển khoản.</li><li>Hệ thống đối soát tự động rồi kích hoạt gói.</li><li>Trong bản DEMO: bấm nút bên dưới để <b>mô phỏng</b> đã thanh toán.</li></ol>
      <div className="modal-actions">
        <button className="btn btn-ghost" disabled={busy} onClick={onVoid}>Huỷ hoá đơn</button>
        <button className="btn btn-primary" disabled={busy} onClick={onPaid}>{busy ? 'Đang xử lý…' : 'Mô phỏng: đã thanh toán'}</button>
      </div>
    </Modal>
  );
}

function InvoiceModal({ inv, shop, onClose }: { inv: Invoice; shop: string; onClose: () => void }) {
  const vat = 0;
  return (
    <Modal title={`Hoá đơn ${inv.number}`} onClose={onClose}>
      <div className="invoice" id="invoice-print">
        <div className="inv-watermark" aria-hidden="true">HOÁ ĐƠN MẪU · DEMO</div>
        <div className="inv-head">
          <div><b className="inv-brand">TIEN404 AI</b><p className="fine">Hoá đơn mẫu cho bản DEMO. Không có giá trị thanh toán hay thuế.</p></div>
          <div className="inv-meta"><span className={`pill ${STATUS[inv.status][1]}`}>{STATUS[inv.status][0]}</span><p>Số: <code>{inv.number}</code></p><p>Ngày: {dateTime(inv.created_at)}</p>{inv.paid_at && <p>Thanh toán: {dateTime(inv.paid_at)}</p>}</div>
        </div>
        <p>Khách hàng: <b>{shop}</b></p>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Mô tả</th><th>Kỳ</th><th className="num">Thành tiền</th></tr></thead>
          <tbody><tr><td>Gói {PLANS[inv.plan].name} — {PLANS[inv.plan].tagline}</td><td>{cycleText(inv.cycle)}</td><td className="num">{vnd(inv.amount_vnd)}</td></tr></tbody>
          <tfoot>
            <tr><td colSpan={2}>VAT (bản DEMO không tính)</td><td className="num">{vnd(vat)}</td></tr>
            <tr><th colSpan={2}>Tổng cộng</th><th className="num">{vnd(inv.amount_vnd + vat)}</th></tr>
          </tfoot>
        </table></div>
        <p className="fine">Nội dung chuyển khoản mẫu: <code>{inv.transfer_note}</code>. Không chuyển tiền vào bất kỳ tài khoản nào theo hoá đơn này.</p>
      </div>
      <div className="modal-actions"><button className="btn btn-ghost" onClick={() => window.print()}>In / Lưu PDF</button><button className="btn btn-primary" onClick={onClose}>Đóng</button></div>
    </Modal>
  );
}
