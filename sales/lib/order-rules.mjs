// TIEN404 Sale — GĐ1 order rules (pure functions, no I/O).
// Source of truth for the n8n "Validate Order" Code node (sales/n8n/build-validate-order.mjs inlines these).
// Base: Create Order KrSn published af9ee686 (strict VND, stock check, 30-min duplicate guard)
// + NEW: stock reservation, so two customers cannot both buy the last item.

// Statuses that keep holding stock, and for how long (hours) after created_at.
// pending   : customer confirmed in chat, shop has not acted yet -> hold 24 h, then released automatically.
// confirmed : shop accepted (or customer paid deposit)           -> hold 7 days.
// paid      : money received, not yet shipped                    -> hold 7 days.
// Anything else (cancelled, shipped, done, returned, expired, blank) holds nothing.
// Rule for the shop: when an order ships, subtract it from Products.stock and set status "shipped".
export const HOLD_HOURS = Object.freeze({ pending: 24, confirmed: 168, paid: 168 });

export function toVnd(v) {
  // Vietnamese dong amounts must be nonnegative SAFE INTEGERS, never parseFloat().
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  let s = String(v ?? '').trim().toLowerCase().replace(/(?:vnd|₫|đ)\s*$/u, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:,\d{3})+\.00$/.test(s)) s = s.replace(/,/g, '').slice(0, -3);
  else if (/^\d{1,3}(?:\.\d{3})+,00$/.test(s)) s = s.replace(/\./g, '').slice(0, -3);
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^\d+\.00$/.test(s)) s = s.slice(0, -3);
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
}

export function normPhone(p) {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('84')) d = '0' + d.slice(2);
  return d;
}

// Quantity of `sku` still held by open orders at time `nowMs`.
export function reservedQty(orders, sku, nowMs, holdHours = HOLD_HOURS) {
  let held = 0;
  for (const o of orders) {
    if (String(o?.sku ?? '').trim().toUpperCase() !== sku) continue;
    const status = String(o?.status ?? '').trim().toLowerCase();
    const hours = Object.prototype.hasOwnProperty.call(holdHours, status) ? holdHours[status] : 0;
    if (!hours) continue;
    const t = Date.parse(o?.created_at);
    // Unknown date on an open order: keep holding (safe side: never oversell).
    if (Number.isFinite(t) && (nowMs - t >= hours * 3600e3 || t > nowMs + 60e3)) continue;
    const q = Number(o?.quantity);
    if (Number.isSafeInteger(q) && q > 0) held += q;
  }
  return held;
}

export function validateOrder({ input, products, orders, nowMs, runKey, rand, holdHours = HOLD_HOURS }) {
  const reject = (message, extra = {}) => ({ ok: false, action: 'rejected', message, ...extra });
  const catalog = (products || []).map((p) => ({
    sku: String(p?.sku ?? p?.['Mã'] ?? '').trim().toUpperCase(),
    name: p?.name ?? p?.['Tên sản phẩm'] ?? '',
    price: p?.price ?? p?.['Giá bán'],
    stock: p?.stock ?? p?.['Tồn kho'],
  })).filter((p) => p.sku);
  const book = (orders || []).filter((o) => o && o.order_id);

  const name = String(input?.customer_name ?? '').trim();
  const phone = normPhone(input?.phone);
  const address = String(input?.address ?? '').trim();
  const sku = String(input?.sku ?? '').trim().toUpperCase();
  const qty = Number(input?.quantity);

  const missing = [];
  if (!name) missing.push('tên người nhận');
  if (!/^0\d{9}$/.test(phone)) missing.push('số điện thoại');
  if (!address) missing.push('địa chỉ');
  if (!sku) missing.push('mã sản phẩm');
  if (!Number.isSafeInteger(qty) || qty <= 0) missing.push('số lượng');
  if (missing.length) return reject('Thông tin chưa hợp lệ: ' + missing.join(', ') + '. Chưa tạo đơn.');

  const product = catalog.find((p) => p.sku === sku);
  if (!product) return reject('Không tìm thấy mã sản phẩm ' + sku + ' trong danh sách. Chưa tạo đơn.');

  const unitPrice = toVnd(product.price);
  const stock = toVnd(product.stock);
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) return reject('Giá sản phẩm ' + sku + ' không hợp lệ.');
  if (!Number.isSafeInteger(stock)) return reject('Sản phẩm ' + sku + ' chưa có số tồn kho hợp lệ. Chưa tạo đơn.');

  // Duplicate guard first (same phone + sku + qty within 30 min, not cancelled) so a resend is not reported as "out of stock".
  const dup = book.find((o) => {
    if (normPhone(o.phone) !== phone) return false;
    if (String(o.sku ?? '').trim().toUpperCase() !== sku) return false;
    if (Number(o.quantity) !== qty) return false;
    if (String(o.status ?? '').toLowerCase() === 'cancelled') return false;
    const t = new Date(o.created_at).getTime();
    return Number.isFinite(t) && nowMs >= t && nowMs - t < 30 * 60 * 1000;
  });
  if (dup) return { ok: false, action: 'duplicate', order_id: dup.order_id, total: dup.total, message: 'Đã có đơn tương tự trong 30 phút gần đây. Chưa tạo đơn mới.' };

  const held = reservedQty(book, sku, nowMs, holdHours);
  const available = Math.max(0, stock - held);
  if (available < qty) {
    return reject('Sản phẩm ' + sku + ' không đủ hàng. Hiện còn ' + available + ' sản phẩm có thể đặt.', { available });
  }

  const total = unitPrice * qty;
  if (!Number.isSafeInteger(total) || total <= 0) return reject('Tổng tiền vượt giới hạn an toàn, cần nhân viên kiểm tra. Chưa tạo đơn.');

  const d = new Date(nowMs);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
  const key = String(runKey ?? '').replace(/[^0-9a-zA-Z]/g, '').slice(-12) || String(nowMs);
  const orderId = 'ORD-' + stamp + '-' + key + '-' + Math.floor(100000 + rand() * 900000);

  return {
    ok: true, action: 'create', order_id: orderId, customer_name: name, phone, address, sku,
    product_name: product.name, quantity: qty, unit_price: unitPrice, total, status: 'pending',
    created_at: d.toISOString(), available_after: available - qty,
  };
}
