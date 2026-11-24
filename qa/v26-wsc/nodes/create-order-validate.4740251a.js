
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
  if (typeof v === 'number') return v;

  const s = String(v ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
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
if (!Number.isInteger(qty) || qty <= 0) {
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

if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
  return reject('Giá sản phẩm ' + sku + ' không hợp lệ.');
}

if (!Number.isInteger(stock) || stock < qty) {
  return reject(
    'Sản phẩm ' + sku +
    ' không đủ tồn kho. Hiện còn ' +
    (Number.isFinite(stock) ? stock : 0) +
    ' sản phẩm.'
  );
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

const orderId =
  'ORD-' + stamp + '-' +
  Math.floor(1000 + Math.random() * 9000);

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
    total: unitPrice * qty,
    status: 'pending',
    created_at: now.toISOString()
  }
}];
