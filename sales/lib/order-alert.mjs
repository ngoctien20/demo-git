// TIEN404 Sale — GĐ1 new-order alert for the shop owner (pure functions, no I/O).
// Used by the Zalo Worker route (sales/worker/order-alert-route.mjs) and the email fallback node.
// The text is built ONLY from validated order facts; nothing free-form from the AI reaches the owner.

export const ORDER_ID_RE = /^ORD-\d{14}-[0-9A-Za-z]{1,12}-\d{6}$/;
export const CHANNELS = Object.freeze({ messenger: 'Messenger', zalo: 'Zalo', telegram: 'Telegram', web: 'Website' });

const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
const safeInt = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

// Strip control chars, links and non-BMP chars (keeps Zalo text_styles offsets exact), cap length.
export function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Returns { ok:true, facts } or { ok:false, error }.
export function checkOrderFacts(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'INVALID_BODY' };
  if (typeof o.order_id !== 'string' || !ORDER_ID_RE.test(o.order_id)) return { ok: false, error: 'BAD_ORDER_ID' };
  if (typeof o.sku !== 'string' || !/^[A-Z0-9-]{1,20}$/.test(o.sku)) return { ok: false, error: 'BAD_SKU' };
  if (!safeInt(o.quantity, 1, 9999) || !safeInt(o.unit_price, 1, 1e9) || !safeInt(o.total, 1, 1e12) || o.total !== o.unit_price * o.quantity) {
    return { ok: false, error: 'INCONSISTENT_TOTAL' };
  }
  if (typeof o.phone !== 'string' || !/^0\d{9}$/.test(o.phone)) return { ok: false, error: 'BAD_PHONE' };
  const name = clean(o.customer_name, 60), address = clean(o.address, 160), product = clean(o.product_name, 80);
  if (!name || !address) return { ok: false, error: 'MISSING_CUSTOMER' };
  const channel = Object.prototype.hasOwnProperty.call(CHANNELS, o.channel) ? CHANNELS[o.channel] : null;
  if (!channel) return { ok: false, error: 'BAD_CHANNEL' };
  const available = safeInt(o.available_after, 0, 1e6) ? o.available_after : null;
  return { ok: true, facts: { order_id: o.order_id, sku: o.sku, product, quantity: o.quantity, unit_price: o.unit_price, total: o.total, phone: o.phone, name, address, channel, available } };
}

const C = { green: 'c_15a85f', orange: 'c_f27806', blue: 'c_0068ff', gray: 'c_7f8c8d' };
function build(parts) {
  let text = ''; const text_styles = [];
  for (const [str, st] of parts) { if (st && st.length) text_styles.push({ start: text.length, len: str.length, st }); text += str; }
  return { text, text_styles };
}

// Zalo message (text + text_styles). One message per order.
export function composeOrderAlert(f) {
  const parts = [
    ['★ ĐƠN MỚI qua ' + f.channel + '\n', ['b', C.blue]],
    [f.order_id + '\n', ['i', C.gray]],
    [f.sku + (f.product ? ' · ' + f.product : '') + '\n'],
    [f.quantity + ' × ' + vnd(f.unit_price) + ' = '], [vnd(f.total), ['b', C.green]],
    ['\n☎ ' + f.name + ' · ' + f.phone],
    ['\n⌂ ' + f.address],
  ];
  if (f.available !== null && f.available <= 3) parts.push(['\n⚠ ' + f.sku + ' chỉ còn ' + f.available + ' có thể đặt', ['b', C.orange]]);
  parts.push(['\nⓘ Gọi khách xác nhận rồi đổi trạng thái trong Sheet.', ['i', C.gray]]);
  return build(parts);
}

// Email fallback (plain text subject + body).
export function composeOrderEmail(f) {
  const subject = '[TIEN404] Đơn mới ' + f.sku + ' × ' + f.quantity + ' = ' + vnd(f.total) + ' (' + f.channel + ')';
  const lines = [
    'Đơn mới qua ' + f.channel + ': ' + f.order_id,
    'Sản phẩm: ' + f.sku + (f.product ? ' - ' + f.product : ''),
    'Số lượng: ' + f.quantity + ' × ' + vnd(f.unit_price) + ' = ' + vnd(f.total),
    'Khách: ' + f.name + ' - ' + f.phone,
    'Địa chỉ: ' + f.address,
  ];
  if (f.available !== null && f.available <= 3) lines.push('Lưu ý: ' + f.sku + ' chỉ còn ' + f.available + ' có thể đặt.');
  lines.push('', 'Gọi khách xác nhận rồi đổi trạng thái trong Sheet (pending → confirmed / cancelled).');
  return { subject, body: lines.join('\n') };
}
