
const input = $('When Executed by Another Workflow').first().json;

const normalizeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Keep Vietnamese phone numbers comparable: digits only, +84 -> 0,
// and restore the leading 0 that Google Sheets drops when a phone is stored as a number.
const normalizePhone = (v) => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9) d = '0' + d;
  return d;
};

const orderId = normalizeText(input.order_id);
const phone = normalizePhone(input.phone);
const newAddress = normalizeText(input.new_address);

const reject = (reason, message) => [{ json: { ok: false, reason: reason, message: message, order_id: orderId } }];

if (!orderId || !phone || !newAddress) {
  return reject('missing_info', 'Thiếu mã đơn, số điện thoại hoặc địa chỉ mới.');
}
if (!/^0[35789]\d{8}$/.test(phone)) {
  return reject('invalid_phone', 'Số điện thoại chưa đúng định dạng.');
}

// Lookup runs with Always Output Data, so an empty result arrives as one empty item.
const rows = $input.all()
  .map((i) => i.json)
  .filter((r) => r && normalizeText(r.order_id) === orderId);

// Not found and phone mismatch share one answer so the chat cannot be used to probe order ids.
const notMatched = 'Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại đã cung cấp.';

if (rows.length === 0) {
  return reject('order_not_matched', notMatched);
}
if (rows.length > 1) {
  return reject('multiple_orders', 'Có nhiều đơn trùng mã, cần nhân viên kiểm tra.');
}

const order = rows[0];

if (normalizePhone(order.phone) !== phone) {
  return reject('order_not_matched', notMatched);
}
if (normalizeText(order.status).toLowerCase() !== 'pending') {
  return reject('not_editable', 'Đơn hàng đã được xử lý nên không thể tự đổi địa chỉ.');
}
if (newAddress.length < 10 || !/[\p{L}]/u.test(newAddress)) {
  return reject('address_too_short', 'Địa chỉ mới quá ngắn, cần ghi rõ hơn.');
}
if (normalizeText(order.address) === newAddress) {
  return reject('same_address', 'Địa chỉ mới giống địa chỉ hiện tại.');
}

return [{
  json: {
    ok: true,
    reason: 'valid',
    message: 'Đơn hàng hợp lệ, có thể cập nhật địa chỉ.',
    order_id: String(order.order_id),
    row_number: order.row_number,
    new_address: newAddress
  }
}];
