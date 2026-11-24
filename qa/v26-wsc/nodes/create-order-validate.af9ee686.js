
const input = $('Order Input').first().json;

const products = $('Read Products').all()
  .map(i => i.json)
  .map(p => ({
    sku: String(p.sku ?? p['Mã'] ?? '').trim().toUpperCase(),
    name: p.name ?? p['Tên sản phẩm'] ?? '',
    price: p.price ?? p['Giá bán'],
    stock: p.stock ?? p['Tồn kho']
  }))
  .filter(p => p.sku);

const orders = $('Read Orders').all()
  .map(i => i.json)
  .filter(o => o && o.order_id);

const toNumber = (v) => {
  // Vietnamese dong amounts must be nonnegative SAFE INTEGERS, never parseFloat().
  // Examples: 159000, "159.000đ", "159,000", "1,234,000.00".
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  let s = String(v ?? '').trim().toLowerCase().replace(/(?:vnd|₫|đ)\s*$/u, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:,\d{3})+\.00$/.test(s)) s = s.replace(/,/g, '').slice(0,-3);
  else if (/^\d{1,3}(?:\.\d{3})+,00$/.test(s)) s = s.replace(/\./g, '').slice(0,-3);
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^\d+\.00$/.test(s)) s = s.slice(0,-3);
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
};

const normPhone = (p) => {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('84')) d = '0' + d.slice(2);
  return d;
};

const reject = (message) => [{
  json: {
    ok: false,
    action: 'rejected',
    message
  }
}];

const name = String(input.customer_name ?? '').trim();
const phone = normPhone(input.phone);
const address = String(input.address ?? '').trim();
const sku = String(input.sku ?? '').trim().toUpperCase();
const qty = Number(input.quantity);

const missing = [];

if (!name) missing.push('tên người nhận');
if (!/^0\d{9}$/.test(phone)) missing.push('số điện thoại');
if (!address) missing.push('địa chỉ');
if (!sku) missing.push('mã sản phẩm');
if (!Number.isSafeInteger(qty) || qty <= 0) {
  missing.push('số lượng');
}

if (missing.length) {
  return reject(
    'Thông tin chưa hợp lệ: ' + missing.join(', ') +
    '. Chưa tạo đơn.'
  );
}

const product = products.find(p => p.sku === sku);

if (!product) {
  return reject(
    'Không tìm thấy mã sản phẩm ' + sku +
    ' trong danh sách. Chưa tạo đơn.'
  );
}

const unitPrice = toNumber(product.price);
const stock = toNumber(product.stock);

if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
  return reject('Giá sản phẩm ' + sku + ' không hợp lệ.');
}

if (!Number.isSafeInteger(stock) || stock < qty) {
  return reject(
    'Sản phẩm ' + sku +
    ' không đủ tồn kho. Hiện còn ' +
    (Number.isFinite(stock) ? stock : 0) +
    ' sản phẩm.'
  );
}

const total = unitPrice * qty;
if (!Number.isSafeInteger(total) || total <= 0) {
  return reject('Tổng tiền vượt giới hạn an toàn, cần nhân viên kiểm tra. Chưa tạo đơn.');
}

const now = new Date();
const windowMs = 30 * 60 * 1000;

const dup = orders.find(o => {
  if (normPhone(o.phone) !== phone) return false;
  if (String(o.sku ?? '').trim().toUpperCase() !== sku) return false;
  if (Number(o.quantity) !== qty) return false;
  if (String(o.status ?? '').toLowerCase() === 'cancelled') return false;

  const t = new Date(o.created_at).getTime();
  return Number.isFinite(t) &&
    now.getTime() >= t &&
    now.getTime() - t < windowMs;
});

if (dup) {
  return [{
    json: {
      ok: false,
      action: 'duplicate',
      order_id: dup.order_id,
      total: dup.total,
      message: 'Đã có đơn tương tự trong 30 phút gần đây. Chưa tạo đơn mới.'
    }
  }];
}

const pad = n => String(n).padStart(2, '0');

const stamp =
  now.getUTCFullYear() +
  pad(now.getUTCMonth() + 1) +
  pad(now.getUTCDate()) +
  pad(now.getUTCHours()) +
  pad(now.getUTCMinutes()) +
  pad(now.getUTCSeconds());

// Execution ID reduces collision risk across runs; unique DB constraints still required.
let runKey = '';
try { runKey = String($execution.id ?? '').replace(/[^0-9a-zA-Z]/g, '').slice(-12); } catch(e) {}
if (!runKey) runKey = String(Date.now());
const orderId = 'ORD-' + stamp + '-' + runKey + '-' + Math.floor(100000 + Math.random() * 900000);

return [{
  json: {
    ok: true,
    action: 'create',
    order_id: orderId,
    customer_name: name,
    phone,
    address,
    sku,
    product_name: product.name,
    quantity: qty,
    unit_price: unitPrice,
    total,
    status: 'pending',
    created_at: now.toISOString()
  }
}];
