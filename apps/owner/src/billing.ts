// TIEN404 plans + DEMO billing. NOTHING here moves money or stores bank details.
// Server path: db/v28-account RPCs (billing_demo_*), when applied. Until then the App keeps the same DEMO state
// in this browser only (localStorage, per Store), so the flow can be tried end to end.
import qrcode from 'qrcode-generator';
import { supabase } from './supabase';
import { isMissingFeature } from './data';

export type PlanKey = 'lite' | 'plus' | 'pro';
export type Cycle = 'month' | 'year';
export type Invoice = {
  id: string; number: string; plan: PlanKey; cycle: Cycle; amount_vnd: number;
  status: 'pending' | 'paid' | 'void'; transfer_note: string; created_at: string; paid_at: string | null;
};
export type Subscription = { plan: 'trial' | PlanKey; cycle: Cycle; status: 'trial' | 'active' | 'canceled'; renews_at: string | null };
export type BillingState = { demo: true; subscription: Subscription; invoices: Invoice[]; source: 'server' | 'browser' };

// Sample prices (minh hoạ) — must match app_private.billing_demo_price in db/v28-account/10. Year = 10 months.
export const PLANS: Record<PlanKey, { name: string; month: number; tagline: string; who: string; features: string[]; best?: boolean }> = {
  lite: {
    name: 'LITE', month: 99000, tagline: 'Dễ dùng, không cần rành máy', who: 'Shop nhỏ, chủ shop lớn tuổi',
    features: ['1 trợ lý AI trả lời khách 24/7', 'Nối bot Zalo bằng mã 6 số, làm ngay trên Zalo', 'Thẻ sản phẩm Messenger mẫu sẵn', 'Tối đa 100 sản phẩm', 'Báo đơn mới qua email'],
  },
  plus: {
    name: 'PLUS', month: 299000, tagline: 'Tuỳ chỉnh sâu cho shop đang lớn', who: 'Shop bán đều mỗi ngày', best: true,
    features: ['Mọi thứ của LITE', 'Zalo + Messenger + chat trên web', 'Tự chỉnh menu, phong cách, thẻ sản phẩm', 'Kho kiến thức và câu hỏi thường gặp', 'Tối đa 1.000 sản phẩm, 3 nhân viên'],
  },
  pro: {
    name: 'PRO', month: 699000, tagline: 'Nhiều chi nhánh, nhiều nhân viên', who: 'Chuỗi cửa hàng, thương hiệu',
    features: ['Mọi thứ của PLUS', 'Nhiều chi nhánh trong một tài khoản', 'Báo cáo doanh thu và khách quay lại', 'Không giới hạn sản phẩm, 10 nhân viên', 'Hỗ trợ ưu tiên'],
  },
};
export const price = (p: PlanKey, c: Cycle) => PLANS[p].month * (c === 'year' ? 10 : 1);
export const planName = (p: Subscription['plan']) => (p === 'trial' ? 'Dùng thử' : PLANS[p].name);

/** Fixed sample receiver. Not a real account; the QR below is NOT a bank transfer QR. */
export const DEMO_BANK = { bank: 'NGÂN HÀNG DEMO (không có thật)', account: '0000 0000 DEMO', holder: 'TIEN404 DEMO' };

/** QR content is plain text on purpose: banking apps will not read it as a transfer. */
export function demoQrSvg(inv: Invoice): string {
  const q = qrcode(0, 'M');
  q.addData(`TIEN404 DEMO - KHONG CHUYEN KHOAN | ${inv.number} | ${inv.amount_vnd} VND`);
  q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

// ---------- browser fallback (same rules as the SQL) ----------
const key = (store: string) => `tien404_billing_demo:${store}`;
const blank = (): Omit<BillingState, 'source'> => ({ demo: true, subscription: { plan: 'trial', cycle: 'month', status: 'trial', renews_at: null }, invoices: [] });
function readLocal(store: string): Omit<BillingState, 'source'> {
  try { const v = JSON.parse(localStorage.getItem(key(store)) || 'null'); if (v && v.subscription && Array.isArray(v.invoices)) return v; } catch { /* ignore */ }
  return blank();
}
function writeLocal(store: string, s: Omit<BillingState, 'source'>) { try { localStorage.setItem(key(store), JSON.stringify(s)); } catch { /* private mode */ } }
const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
const vnDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');

const local = {
  checkout(store: string, plan: PlanKey, cycle: Cycle) {
    const s = readLocal(store);
    s.invoices.forEach(i => { if (i.status === 'pending') i.status = 'void'; });
    const number = `HD-DEMO-${vnDate()}-${rnd()}`;
    s.invoices.unshift({ id: crypto.randomUUID(), number, plan, cycle, amount_vnd: price(plan, cycle), status: 'pending',
      transfer_note: `T404DEMO ${number.slice(8)}`, created_at: new Date().toISOString(), paid_at: null });
    s.invoices = s.invoices.slice(0, 24); writeLocal(store, s); return s;
  },
  confirm(store: string, id: string) {
    const s = readLocal(store); const i = s.invoices.find(x => x.id === id && x.status === 'pending');
    if (!i) throw new Error('invoice_not_pending');
    i.status = 'paid'; i.paid_at = new Date().toISOString();
    const cur = s.subscription;
    const base = cur.status === 'active' && cur.plan === i.plan && cur.cycle === i.cycle && cur.renews_at && new Date(cur.renews_at) > new Date() ? new Date(cur.renews_at) : new Date();
    if (i.cycle === 'year') base.setFullYear(base.getFullYear() + 1); else base.setMonth(base.getMonth() + 1);
    s.subscription = { plan: i.plan, cycle: i.cycle, status: 'active', renews_at: base.toISOString() };
    writeLocal(store, s); return s;
  },
  void(store: string, id: string) {
    const s = readLocal(store); const i = s.invoices.find(x => x.id === id && x.status === 'pending');
    if (!i) throw new Error('invoice_not_pending');
    i.status = 'void'; writeLocal(store, s); return s;
  },
  cancel(store: string) {
    const s = readLocal(store); if (s.subscription.status !== 'active') throw new Error('nothing_to_cancel');
    s.subscription.status = 'canceled'; writeLocal(store, s); return s;
  },
  reset(store: string) { try { localStorage.removeItem(key(store)); } catch { /* ignore */ } },
};

function isState(v: unknown): v is Omit<BillingState, 'source'> {
  const o = v as { subscription?: { plan?: unknown }; invoices?: unknown } | null;
  return !!o && typeof o === 'object' && !!o.subscription && typeof o.subscription.plan === 'string' && Array.isArray(o.invoices);
}

// ---------- API: server RPC first, browser fallback if V28 is not applied ----------
let serverMissing = false;
async function call(fn: string, args: Record<string, unknown>, fallback: () => Omit<BillingState, 'source'>): Promise<BillingState> {
  if (!serverMissing) {
    const r = await supabase.rpc(fn, args);
    if (!r.error && isState(r.data)) return { ...r.data, source: 'server' };
    if (r.error && !isMissingFeature(r.error)) throw r.error;
    // Unexpected answer (older server, proxy page…): never crash the page, keep the DEMO in this browser.
    serverMissing = true;
  }
  return { ...fallback(), source: 'browser' };
}
export const billing = {
  state: (store: string) => call('billing_demo_state', { p_store: store }, () => readLocal(store)),
  checkout: (store: string, plan: PlanKey, cycle: Cycle) => call('billing_demo_checkout', { p_store: store, p_plan: plan, p_cycle: cycle }, () => local.checkout(store, plan, cycle)),
  confirm: (store: string, id: string) => call('billing_demo_confirm', { p_store: store, p_invoice: id }, () => local.confirm(store, id)),
  void: (store: string, id: string) => call('billing_demo_void', { p_store: store, p_invoice: id }, () => local.void(store, id)),
  cancel: (store: string) => call('billing_demo_cancel', { p_store: store }, () => local.cancel(store)),
  resetBrowser: (store: string) => local.reset(store),
};

// Signup can carry a plan the visitor picked on the pricing page (?goi=plus); the Plan page picks it up once.
const PENDING = 'tien404_pending_plan';
export function rememberPlan(p: string | null) { if (p && p in PLANS) try { sessionStorage.setItem(PENDING, p); } catch { /* ignore */ } }
export function takePendingPlan(): PlanKey | null {
  try { const p = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return p && p in PLANS ? (p as PlanKey) : null; } catch { return null; }
}
