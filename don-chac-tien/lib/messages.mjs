// Câu chữ gửi chủ shop và khách. Ngắn, mỗi ý một dòng, chữ số rõ, không viết tắt khó hiểu.
import { vnd, local } from './vn.mjs';

export const HELP = [
  'Trợ lý đơn chắc tiền. Bác nhắn như nói chuyện:',
  '',
  '• Tạo đơn: chị Lan 2 cái A003 giao Q7',
  '   hoặc chỉ số tiền: cô Hoa 350k',
  '• Tiền về: đã nhận đơn 12',
  '• Xem ai chưa trả: ai chưa trả',
  '• Tổng kết: hôm nay',
  '• Xem kho: kho',
  '• Huỷ: huỷ đơn 12   • Đã giao: đã giao 12',
  '',
  'Lần đầu: nhắn số tài khoản để bot làm mã QR, ví dụ:',
  'ngân hàng MB 0123456789 NGUYEN VAN A',
  'và tên shop: tên shop Thời trang Hoa',
].join('\n');

export const STATUS_VI = {
  cho_tra: 'chờ chuyển khoản', tra_thieu: 'chuyển thiếu', da_tra: 'đã trả đủ', cod: 'giao thu hộ (COD)',
  da_giao: 'đã giao', huy: 'đã huỷ', het_han: 'hết giữ hàng',
};

export const itemsLine = (o) => (o.items.length
  ? o.items.map((i) => i.qty + ' × ' + i.name + ' (' + i.sku + ')').join(', ')
  : 'Đơn hàng');

export function moneyLines(o) {
  const lines = [];
  for (const i of o.items) lines.push(i.qty + ' × ' + i.name + ' (' + i.sku + ') = ' + vnd(i.qty * i.price));
  if (!o.items.length) lines.push('Tiền hàng: ' + vnd(o.total - o.ship + o.discount));
  if (o.ship) lines.push('Phí giao: ' + vnd(o.ship));
  if (o.discount) lines.push('Giảm: −' + vnd(o.discount));
  lines.push('TỔNG: ' + vnd(o.total));
  const listed = o.items.reduce((s, i) => s + i.qty * i.price, 0) + o.ship - o.discount;
  if (o.items.length && listed !== o.total) lines.push('(giá bác chốt, kho ghi ' + vnd(listed) + ')');
  return lines;
}

export function orderCreated(o, shop, now) {
  const head = '✅ Đã tạo ĐƠN SỐ ' + o.no + (o.name ? ' · ' + o.name : '');
  const lines = [head, ...moneyLines(o)];
  if (o.cod && o.due) lines.push('Thu hộ khi giao, cọc trước ' + vnd(o.due) + '.');
  else if (o.cod) lines.push('Thu hộ khi giao (COD), không cần chuyển khoản.');
  if (o.items.length) lines.push(o.status === 'cod' ? 'Đã giữ hàng cho đơn này.' : 'Đã giữ hàng tới ' + local(o.hold_until, now).label + '.');
  if (o.due && shop.bank) lines.push('', '👇 Bác bấm giữ vào tin bên dưới → Chuyển tiếp cho khách.');
  if (o.due && !shop.bank) lines.push('', '❗ Chưa có số tài khoản nên chưa làm được mã QR.', 'Nhắn: ngân hàng MB 0123456789 NGUYEN VAN A');
  return lines.join('\n');
}

/** Tin để chủ chuyển tiếp cho khách. */
export function customerMessage(o, shop) {
  const b = shop.bank;
  return [
    (shop.name || 'Shop') + ' gửi ' + (o.name || 'anh/chị') + ':',
    itemsLine(o),
    (o.cod ? 'Tiền cọc: ' : 'Số tiền: ') + vnd(o.due - o.paid),
    'Chuyển khoản: ' + b.short + ' · ' + b.account + ' · ' + b.holder,
    'Nội dung: ' + o.code,
    'Quét mã QR là có sẵn số tiền và nội dung. Cảm ơn anh/chị!',
  ].join('\n');
}

export function paidNotice(o, r, shop) {
  const via = r.via === 'bank' ? 'ngân hàng báo' : r.via === 'notice' ? 'tin ngân hàng bác chuyển' : 'bác xác nhận';
  if (r.result === 'partial') {
    return '⚠️ ĐƠN ' + o.no + (o.name ? ' · ' + o.name : '') + ': khách mới chuyển ' + vnd(r.amount) + ' (' + via + ').\nCòn thiếu ' + vnd(o.due - o.paid) + '. Chưa giao vội nhé.';
  }
  const lines = ['💰 TIỀN VỀ · ĐƠN ' + o.no + (o.name ? ' · ' + o.name : ''), vnd(r.amount) + ' (' + via + ')'];
  if (o.cod) lines.push('Đã nhận cọc. Khi giao thu thêm ' + vnd(o.total - o.paid) + '.');
  else lines.push('Đã đủ tiền. Bác giao hàng được rồi.');
  if (r.extra > 0) lines.push('Khách chuyển dư ' + vnd(r.extra) + ', bác nhớ trả lại.');
  if (r.late) lines.push(r.restocked ? 'Tiền về trễ nhưng vẫn còn hàng, bot đã giữ lại.' : '❗ Tiền về trễ và hàng đã hết. Bác hoàn tiền hoặc nhập thêm hàng.');
  lines.push('Giao xong nhắn: đã giao ' + o.no);
  void shop;
  return lines.join('\n');
}

export function orderLine(o, now) {
  const left = o.due - o.paid;
  let s = 'Đơn ' + o.no + (o.name ? ' · ' + o.name : '') + ' · ';
  if (o.status === 'cho_tra') s += 'chờ ' + vnd(left) + ', giữ tới ' + local(o.hold_until, now).label;
  else if (o.status === 'tra_thieu') s += 'còn thiếu ' + vnd(left);
  else s += STATUS_VI[o.status] + ' ' + vnd(o.total);
  return s;
}
